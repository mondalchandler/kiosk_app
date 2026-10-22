using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;

public sealed class KioskServer : IDisposable {
    private readonly string root;
    private readonly string mediaDir;
    private readonly HttpListener listener;
    private static readonly HashSet<string> Images = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
        ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"
    };
    private static readonly HashSet<string> Videos = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
        ".mp4", ".mov", ".webm", ".m4v"
    };
    private static readonly HashSet<string> StaticFiles = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
        "index.html", "styles.css", "app.js", "placeholder.png", "static-center-banner.png"
    };
    private static readonly Dictionary<string, string> Types = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
        { ".html", "text/html; charset=utf-8" }, { ".css", "text/css; charset=utf-8" },
        { ".js", "text/javascript; charset=utf-8" }, { ".png", "image/png" },
        { ".jpg", "image/jpeg" }, { ".jpeg", "image/jpeg" },
        { ".gif", "image/gif" }, { ".webp", "image/webp" },
        { ".avif", "image/avif" }, { ".mp4", "video/mp4" },
        { ".mov", "video/quicktime" }, { ".webm", "video/webm" },
        { ".m4v", "video/mp4" }
    };

    public string Url { get; private set; }

    private KioskServer(string folder, HttpListener active, string url) {
        root = folder;
        mediaDir = Path.Combine(root, "media");
        Directory.CreateDirectory(mediaDir);
        listener = active;
        Url = url;
    }

    public static KioskServer Start(string folder) {
        for (int port = 18080; port <= 18120; port++) {
            var candidate = new HttpListener();
            string url = "http://localhost:" + port + "/";
            candidate.Prefixes.Add(url);
            try {
                candidate.Start();
                return new KioskServer(Path.GetFullPath(folder), candidate, url);
            } catch (HttpListenerException) {
                candidate.Close();
            }
        }
        throw new InvalidOperationException("Could not find an available local port (18080-18120).");
    }

    public void Serve() {
        while (listener.IsListening) {
            HttpListenerContext context = listener.GetContext();
            ThreadPool.QueueUserWorkItem(state => Handle((HttpListenerContext)state), context);
        }
    }

    private void Handle(HttpListenerContext context) {
        try {
            var request = context.Request;
            var response = context.Response;
            if (request.HttpMethod != "GET" && request.HttpMethod != "HEAD") {
                SendText(request, response, 405, "Method not allowed", "text/plain; charset=utf-8");
                return;
            }
            string urlPath = Uri.UnescapeDataString(request.Url.AbsolutePath);
            if (urlPath == "/api/videos") {
                SendText(request, response, 200, MediaJson(), "application/json; charset=utf-8");
                return;
            }
            if (urlPath == "/") urlPath = "/index.html";
            string file;
            if (urlPath.StartsWith("/media/", StringComparison.OrdinalIgnoreCase)) {
                string name = urlPath.Substring(7);
                if (name.IndexOfAny(new char[] {'/', '\\'}) >= 0 || name == "." || name == ".." || !Allowed(name)) {
                    SendText(request, response, 403, "Forbidden", "text/plain; charset=utf-8");
                    return;
                }
                file = Path.Combine(mediaDir, name);
            } else {
                string name = urlPath.TrimStart('/');
                if (!StaticFiles.Contains(name)) {
                    SendText(request, response, 403, "Forbidden", "text/plain; charset=utf-8");
                    return;
                }
                file = Path.Combine(root, name);
            }
            if (!File.Exists(file)) {
                SendText(request, response, 404, "Not found", "text/plain; charset=utf-8");
                return;
            }
            SendFile(request, response, file, urlPath.StartsWith("/media/", StringComparison.OrdinalIgnoreCase));
        } catch (IOException) {
            // Browsers cancel range requests when seeking or replacing a video.
        } catch (HttpListenerException) {
            // The client closed the connection while a response was in flight.
        } catch (ObjectDisposedException) {
            // The browser or server closed a stream.
        } catch (Exception error) {
            Console.Error.WriteLine("Kiosk request error: " + error.Message);
        } finally {
            try { context.Response.Close(); } catch { }
        }
    }

    private static bool Allowed(string file) {
        string ext = Path.GetExtension(file);
        return Images.Contains(ext) || Videos.Contains(ext);
    }

    private string MediaJson() {
        var files = Directory.EnumerateFiles(mediaDir)
            .Where(Allowed)
            .Select(file => new FileInfo(file))
            .OrderByDescending(info => info.CreationTimeUtc)
            .Select(info => new {
                url = "/media/" + Uri.EscapeDataString(info.Name) + "?v=" + info.LastWriteTimeUtc.Ticks,
                kind = Videos.Contains(info.Extension) ? "video" : "image",
                mtimeMs = new DateTimeOffset(info.LastWriteTimeUtc).ToUnixTimeMilliseconds(),
                birthtimeMs = new DateTimeOffset(info.CreationTimeUtc).ToUnixTimeMilliseconds(),
                sortKey = new DateTimeOffset(info.CreationTimeUtc).ToUnixTimeMilliseconds()
            }).ToArray();
        return new JavaScriptSerializer { MaxJsonLength = int.MaxValue }.Serialize(new {
            ok = true, count = files.Length, requireAtLeast = 10,
            refreshSeconds = 10, mirrorVideos = false,
            staticCenterImage = "/static-center-banner.png", media = files
        });
    }

    private static void SendText(HttpListenerRequest request, HttpListenerResponse response, int status, string text, string type) {
        byte[] bytes = Encoding.UTF8.GetBytes(text);
        response.StatusCode = status;
        response.ContentType = type;
        response.ContentLength64 = bytes.Length;
        if (request.HttpMethod != "HEAD") response.OutputStream.Write(bytes, 0, bytes.Length);
    }

    private static void SendFile(HttpListenerRequest request, HttpListenerResponse response, string file, bool isMedia) {
        string ext = Path.GetExtension(file);
        string type;
        response.ContentType = Types.TryGetValue(ext, out type) ? type : "application/octet-stream";
        response.Headers["Cache-Control"] = isMedia ? "private, max-age=300" : "no-store";
        response.Headers["Accept-Ranges"] = "bytes";
        using (var stream = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite, 65536)) {
            long size = stream.Length;
            long start = 0;
            long end = size - 1;
            string range = request.Headers["Range"];
            if (!String.IsNullOrEmpty(range)) {
                Match match = Regex.Match(range, @"^bytes=(\d+)-(\d*)$");
                if (!match.Success) {
                    response.StatusCode = 416;
                    response.Headers["Content-Range"] = "bytes */" + size;
                    return;
                }
                start = long.Parse(match.Groups[1].Value);
                if (match.Groups[2].Success && match.Groups[2].Value.Length > 0)
                    end = Math.Min(long.Parse(match.Groups[2].Value), end);
                else
                    end = Math.Min(start + 2 * 1024 * 1024 - 1, end);
                if (start >= size || end < start) {
                    response.StatusCode = 416;
                    response.Headers["Content-Range"] = "bytes */" + size;
                    return;
                }
                response.StatusCode = 206;
                response.Headers["Content-Range"] = "bytes " + start + "-" + end + "/" + size;
            }
            response.ContentLength64 = Math.Max(0, end - start + 1);
            if (request.HttpMethod == "HEAD") return;
            stream.Position = start;
            byte[] buffer = new byte[65536];
            long remaining = end - start + 1;
            while (remaining > 0) {
                int count = stream.Read(buffer, 0, (int)Math.Min(buffer.Length, remaining));
                if (count <= 0) break;
                response.OutputStream.Write(buffer, 0, count);
                remaining -= count;
            }
        }
    }

    public void Dispose() { listener.Stop(); listener.Close(); }
}
