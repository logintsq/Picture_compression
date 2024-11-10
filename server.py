import http.server
import socketserver
import webbrowser
import os

# 设置端口
PORT = 8080

# 设置处理程序
Handler = http.server.SimpleHTTPRequestHandler

# 创建服务器
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"服务器运行在 http://localhost:{PORT}/")
    
    # 设置 Chrome 浏览器路径
    browser_path = r"D:\Google\Chrome\Application\chrome.exe"
    webbrowser.register('chrome', None, webbrowser.BackgroundBrowser(browser_path))
    
    # 打开浏览器
    url = f"http://localhost:{PORT}"
    webbrowser.get('chrome').open(url)
    
    # 启动服务器
    httpd.serve_forever() 