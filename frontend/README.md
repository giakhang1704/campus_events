# Angular 21 local preview

Node 24; npm ci; npm start. Mở http://localhost:4200. Backend local tại 8080, proxy /api cấu hình trong proxy.conf.json. npm run build xuất dist/campus-events/browser. Docker Compose là cách chạy cả stack được hướng dẫn ở README gốc.

Angular hiển thị trạng thái môi trường từ API thật và nhúng mockup đã đồng bộ trong public/mockup. Mockup vẫn localStorage, chưa chuyển các chức năng nghiệp vụ sang Angular/API. Bản nguồn bất biến nằm trong docs/references/mockup-original.
