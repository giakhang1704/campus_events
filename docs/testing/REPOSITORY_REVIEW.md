# Rà soát repository BKevent — 12/11/2026

Nhánh: `refactor/i2-backend-layered`, baseline commit `4d56706`. Rà soát cấu trúc, đường dẫn/tài liệu, phụ thuộc FE/BE/DB, chạy local, build và regression; bổ sung nâng cấp dependency npm theo yêu cầu người dùng. Không thay schema/dữ liệu dev, API, vai trò cố định hoặc phạm vi I1/I2.

## Cấu trúc hiện hành và kết luận

```text
frontend/       Angular SPA; core API/auth, features, shared, assets, mockup nguồn
backend/        Spring Boot layered monolith; controller, service/impl,
                repository/jdbc, dto, model, mapper, validation, security, exception, config
database/       Schema baseline, query mẫu, SQL regression, hướng dẫn seed/migrations
deploy/         Hướng dẫn phương án hosting, chưa phải cấu hình đã deploy
docs/           API, kiến trúc, quyết định, hướng dẫn và bằng chứng kiểm thử
scripts/        Khởi tạo local, seed opt-in và smoke/integration/browser test
.github/        PR template; chưa có workflow GitHub Actions
compose.yaml    Stack dev, localhost, volume PostgreSQL bền vững
compose.i1-test.yaml  Stack test riêng, DB tmpfs, không dùng volume dev
```

Đây là monorepo (frontend/backend/database trong một repo). Frontend và backend build riêng. Backend là một ứng dụng phân tầng, có 6 service interface và 7 repository interface; không phải mỗi interface là một service triển khai riêng.

Kiểm tra source không thấy Controller phụ thuộc Repository/JDBC hoặc Service gọi implementation JDBC/viết SQL. Model nội bộ và response DTO tách riêng; SQL thuộc repository/jdbc. Route guard frontend không thay kiểm tra quyền backend. .env/node_modules/target bị ignore và không được Git track. Bản tham khảo gốc trong docs/references giữ nguyên, không phải schema/code chạy hiện hành.

## Lỗi đã tìm và xử lý

### 1. Build local thiếu @angular/router — đã sửa môi trường

Source package.json/lockfile đã khai báo router nhưng node_modules trên máy chưa được đồng bộ sau khi đổi nhánh. Lần build đầu báo TS2307 và nhiều lỗi dây chuyền. Cài sạch npm ci giải quyết lỗi, không xóa import hoặc thay logic router. Sau khi pull/switch nhánh có thay lockfile, phải npm ci lại.

### 2. Dependency npm — đã nâng cấp, còn cảnh báo moderate ở toolchain

Nâng đồng bộ framework/compiler Angular **21.0.0 → 21.2.26**, CLI/build **21.0.0 → 21.2.29**; giữ TypeScript 5.9.3/RxJS 7.8.2/Node 24. Tạo lockfile mới trong môi trường Linux, cài sạch host bằng npm ci. Không sử dụng --force, --legacy-peer-deps hoặc ép override major của dependency con.

| Audit npm | Trước | Sau |
|---|---:|---:|
| Critical | 1 | 0 |
| High | 15 | 0 |
| Moderate | 19 | 16 |
| Low | 1 | 0 |
| Tổng số mục dependency bị đánh dấu | 36 | 16 |
| Runtime audit sau nâng cấp (`--omit=dev`) | — | 0 |

36 mục không đồng nghĩa 36 lỗ hổng độc lập hoặc app đã bị khai thác: npm có thể đánh dấu nhiều gói cha do cùng một gói con bị ảnh hưởng. Critical cũ nằm ở piscina (dev/build dependency); có cả cảnh báo high trên Angular runtime nên cần nâng cấp.

16 moderate còn lại đều nằm trong chuỗi @angular/cli → pacote và các gói con, không nằm trong dependency runtime hiện hành. Chúng quy về hai advisory:

- [glob cancellation bypass](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4): glob 13.x hiện được CLI kéo vào, bản sửa upstream 14.0.2.
- [minimatch pattern amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249): minimatch 10.x hiện được CLI kéo vào, bản sửa upstream 11.0.1.

npm đề xuất downgrade CLI về 16.2.16 cho chuỗi này; không áp dụng vì không phù hợp Angular 21. Cần theo dõi bản CLI/dependency upstream cập nhật hoặc đánh giá riêng thay đổi major trước khi override. Không che cảnh báo bằng audit=false. Công cụ build vẫn có rủi ro khi xử lý input không tin cậy; không coi devDependency là mặc nhiên an toàn.

[Bảng tương thích Angular](https://angular.dev/reference/versions): dòng 21 tương thích Node 24 và TypeScript 5.9 đang dùng. Audit npm không kiểm tra thư viện Java, image Docker hoặc chứng minh toàn hệ thống không còn lỗ hổng.

### 3. Khởi động frontend trước backend — đã sửa

Compose trước đây chỉ đợi container backend được tạo/start, chưa đợi API sẵn sàng, nên lần truy cập đầu có thể gặp nginx 502. Đã thêm backend healthcheck gọi /api/health bằng curl (đã xác nhận curl có trong runtime image), frontend phụ thuộc backend service_healthy. Smoke script chờ/retry có giới hạn mặc định 60 giây thay vì lỗi ngay lúc khởi động. Readiness ban đầu không thay cơ chế xử lý gián đoạn khi backend bị restart trong lúc app đang dùng.

### 4. Mockup/build production và hướng dẫn không khớp — đã sửa

Angular production chủ động loại public/mockup khỏi output; Docker dùng production. Trước đây hướng dẫn mở /mockup/index.html trên Docker và nginx fallback khiến thiếu file vẫn trả index Angular với HTTP 200, dễ hiểu nhầm là mockup.

- Giữ nguyên mockup nguồn và các phần DEFERRED/comment; không đóng gói mockup vào production.
- Nginx trả đúng 404 cho mockup/assets bị thiếu.
- Xem mockup qua dev server hoặc Python phục vụ frontend/public tại /mockup/index.html. Phục vụ đúng root này cũng sửa lỗi logo /assets/hcmut.png không tải khi chỉ serve thư mục mockup.
- Cập nhật README, LOCAL_RUN, API I1, database/Neon README: màn Angular Sinh viên đã có API thật, seed đã có và backend đã có cấu hình DB qua biến môi trường. Phân biệt trạng thái hiện tại và các đoạn log lịch sử.

## Kiểm chứng

Đã chạy trước khi nâng Angular:

- Production build sau npm ci: PASS.
- Docker build Java 21 và 17 unit tests: PASS.
- scripts/test-i1.ps1 với Playwright/Edge: PASS HTTP/PostgreSQL, auth/CSRF/RBAC/phiên/audit/Admin concurrency, Organizer create/edit/publish/version conflict, published search/detail và browser regression/mobile/offline logout.
- SQL 02_registration_reset.sql trên database test riêng: PASS, fixtures ROLLBACK.
- node scripts/smoke/mockup.cjs: PASS.
- docker compose config --quiet, backend healthy, local smoke: PASS.
- Production /mockup/index.html trả 404; server mockup riêng tải HTML BKevent và PNG logo: PASS.

Sau nâng Angular:

- npm ci trên host và npm run build: PASS.
- npm audit: 0 high/critical, 16 moderate; npm audit --omit=dev: 0.
- Docker/Linux npm ci và production build: PASS với lockfile mới.
- scripts/test-i1.ps1 + Playwright/Edge sau nâng cấp: PASS toàn bộ HTTP/PostgreSQL và browser regression tài khoản/sự kiện/mobile/offline logout.
- Compose khởi động backend healthy trước frontend; local smoke sau build mới: PASS.
- Markdown links và git diff --check: PASS.

Log máy local (không commit): frontend/.angular/repo-*.log/json và backend/target/repo-*.log. File package.json/package-lock.json mới được track; node_modules, log, screenshot, .env không được đưa vào Git.

## Việc cần tiếp tục trước deploy

1. Theo dõi/xử lý hai advisory moderate của toolchain, thêm kiểm tra dependency Java và container image trong quy trình phát hành.
2. Chọn và triển khai migration có version khi schema thay đổi; baseline init chỉ chạy trên DB rỗng, không nâng cấp volume cũ. Health hiện kiểm tra đúng 15 bảng: phải cập nhật cùng kế hoạch migration nếu thêm bảng I2.
3. Chưa có render.yaml/vercel.json, chưa xác minh proxy/cookie/SSL/secret/DB user production trên Render–Vercel–Neon. deploy/ hiện là tài liệu, không phải bằng chứng deploy.
4. Chưa có CI tự động; các test hiện chạy bằng script. PR vẫn cần thành viên khác review.
5. Đăng ký tham gia, FIFO/email, QR và báo cáo đang là nghiệp vụ increment sau; nút tắt/trang đang phát triển là giới hạn đã ghi nhận, không phải lỗi do refactor.

Chưa thực hiện pentest, kiểm thử tải, dependency scan Java/container hoặc review độc lập. Kết quả trên giới hạn ở source/config và các ca đã chạy, không thay nghiệm thu CP1.
