import http.server
import socketserver
import os
import sys

PORT = 8080
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")

if __name__ == "__main__":
    os.chdir(PUBLIC_DIR)
    handler = http.server.SimpleHTTPRequestHandler
    print("Starting RRC Manager StarAdmin-2 Web Application...")
    print(f"Server running at: http://localhost:{PORT}")
    try:
        socketserver.TCPServer.allow_reuse_address = True
        with socketserver.TCPServer(("", PORT), handler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        sys.exit(0)
