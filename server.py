import os
import sys
import socket
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 5000

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"

class CustomHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

def run():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    local_ip = get_local_ip()
    local_url = f"http://localhost:{PORT}"
    network_url = f"http://{local_ip}:{PORT}"

    print("=" * 60)
    print("FOOD GI SCANNER - AI APP SERVER")
    print("=" * 60)
    print(f"Laptop/Desktop: {local_url}")
    print(f"Mobile Phone:   {network_url}")
    print("=" * 60)
    print("Phone par open karke 'Install App' ya 'Add to Home screen' karein.")
    print("Server running... Press Ctrl+C to stop.")
    print("=" * 60)

    try:
        webbrowser.open(local_url)
    except Exception:
        pass

    server = HTTPServer(('0.0.0.0', PORT), CustomHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")

if __name__ == '__main__':
    run()
