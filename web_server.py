import http.server
import socketserver
import os
import sys

# Read the PORT from Railway's environment variable, fallback to 8080 locally
PORT = int(os.environ.get("PORT", 8080))
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")

if __name__ == "__main__":
    os.chdir(PUBLIC_DIR)
    handler = http.server.SimpleHTTPRequestHandler
    print("Starting RRC Manager StarAdmin-2 Web Application...")
    print(f"Server running on port: {PORT}")
    try:
        socketserver.TCPServer.allow_reuse_address = True
        # Bind to 0.0.0.0 so Railway can route external traffic into the container
        with socketserver.TCPServer(("0.0.0.0", PORT), handler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        sys.exit(0)