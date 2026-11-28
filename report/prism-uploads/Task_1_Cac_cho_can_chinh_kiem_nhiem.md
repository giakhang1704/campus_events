# Hướng dẫn chỉnh Task 1 để đồng bộ với báo cáo Task 2.1-2.6

Tài liệu này hướng dẫn cập nhật Task 1 theo bản báo cáo Task 2.1-2.6 đã hoàn thiện. Bản gốc Task 1 chưa được thay đổi. Các vị trí được đối chiếu theo báo cáo `main (1)(1).pdf`; số trang dùng số in ở chân trang, không tính bìa. Có thể dùng trực tiếp các đoạn trích dưới đây sau khi nhóm xác nhận giả định năng lực và lịch trao đổi với khách hàng.

Phương án giữ 5 thành viên và 5 vai trò chính PM, BA, BE, FE, QA. PM kiêm hỗ trợ Backend; BA kiêm hỗ trợ thiết kế UI và lập trình Frontend. BE/FE vẫn là đầu mối kỹ thuật của từng phía; việc hỗ trợ được phân công theo tác vụ và được cộng vào tải của cùng một người.

## 1. Task 1.7.1: chỉnh phần phân vai và kiêm nhiệm

Đây là chỗ cần chỉnh chính, tại trang in 21-23. Bản cũ đã cho phép hỗ trợ chéo; cần ghi rõ cả PM hỗ trợ Backend và BA hỗ trợ UI/Frontend để giảm tải cho hai lập trình viên chính.

### 1.1. Đoạn “Mô hình tổ chức nhóm dự án” - trang 21

Tìm câu bắt đầu bằng:

> Nhóm phân công mỗi thành viên phụ trách một vai trò chính, đồng thời hỗ trợ các công việc liên quan trong phạm vi chuyên môn phù hợp.

Giữ câu này và bổ sung ngay sau:

> Thành viên PM kiêm hỗ trợ Backend ở các phần việc cấu hình email, tạo dữ liệu giả lập, quản lý sự kiện, đăng ký/hủy, email, điểm danh thủ công và xuất CSV/Excel. Thành viên BA hỗ trợ thiết kế mockups, giao diện tài khoản/phân quyền và giao diện báo cáo. Mỗi tác vụ có một người thực hiện chính và người kiểm tra riêng; thời gian kiêm nhiệm được tính chung với công việc chính của cùng thành viên.

Giữ mô hình cấu trúc phẳng, PM và BA là hai người riêng biệt, cùng các công cụ phối hợp hiện có.

### 1.2. Mục “Vai trò và trách nhiệm” - trang 22

**Cuối đoạn trách nhiệm PM**, bổ sung:

> Bên cạnh công việc quản lý, PM tham gia thực hiện các phần việc Backend được phân công theo kế hoạch. Khi lập lịch, nhóm tính chung thời gian quản lý và thời gian lập trình của người PM để tránh phân công trùng thời điểm. Mã nguồn do PM tạo tuân thủ quy trình kiểm thử và Pull Request như các thành viên phát triển khác.

**Cuối đoạn trách nhiệm Backend Developer**, bổ sung:

> Backend Developer giữ đầu mối thống nhất thiết kế, API và tích hợp Backend; phụ trách tài khoản/phân quyền, giao dịch sức chứa/waitlist, xác thực QR và truy vấn báo cáo theo kế hoạch. BE thống nhất giao diện giữa các phần việc với PM và review Backend do PM thực hiện; PM nhận phần quản lý sự kiện, đăng ký/hủy, email, điểm danh thủ công và xuất tệp đã được xác định cụ thể.

**Cuối đoạn trách nhiệm BA**, bổ sung:

> Ngoài phân tích nghiệp vụ và hỗ trợ kiểm thử, BA tham gia thiết kế mockups, lập trình giao diện tài khoản/phân quyền và giao diện báo cáo/tải tệp theo phân công. FE thống nhất cách kết nối API và review UI do BA thực hiện; QA kiểm thử các luồng hoàn chỉnh. BA vẫn giữ trách nhiệm làm rõ yêu cầu và tiêu chí chấp nhận.

**Cuối đoạn trách nhiệm Frontend Developer**, bổ sung:

> Frontend Developer giữ đầu mối cấu trúc Angular, kết nối API và tích hợp giao diện; phụ trách các luồng sự kiện, đăng ký/waitlist và điểm danh. BA hỗ trợ các màn hình độc lập đã được phân công; FE review mockups, mã UI và kết quả tích hợp trước khi chuyển kiểm thử.

### 1.3. Bảng 10 “Phân công vai trò chính và nhiệm vụ phối hợp” - trang 23

Thay nội dung cột “Nhiệm vụ phối hợp” của PM và BA, đồng thời làm rõ trách nhiệm phối hợp của BE/FE:

| Thành viên | Vai trò chính | Nhiệm vụ phối hợp |
|---|---|---|
| 1 | PM | Kiêm hỗ trợ Backend theo tác vụ; vẫn điều phối, theo dõi và quản lý dự án |
| 2 | BA | Hỗ trợ UI/Frontend: mockups, giao diện tài khoản/phân quyền, báo cáo; hỗ trợ kiểm thử nghiệp vụ |
| 3 | Backend Developer | Đầu mối Backend; phối hợp và review phần PM thực hiện |
| 4 | Frontend Developer | Đầu mối Frontend; phối hợp và review phần BA thực hiện |
| 5 | QA/Tester | Kiểm thử độc lập; phối hợp BA và Dev xác minh nghiệp vụ và chất lượng |

Không cần ghi số giờ chi tiết vào bảng vai trò ở Task 1; giờ công từng phần việc và từng người nằm ở Task 2.6.

### 1.4. Mục “Nguyên tắc kiêm nhiệm và kiểm tra chéo” - trang 23

Giữ nguyên quy định người tạo Pull Request không tự phê duyệt. Bổ sung để áp dụng rõ cho cả PM và BA:

> Quy tắc kiểm duyệt độc lập áp dụng cả khi PM và BA kiêm lập trình: BE review Backend của PM; FE review mockups/UI của BA; QA review seed và kiểm thử độc lập. PM điều phối xử lý dựa trên kết quả kiểm tra. Người tạo không tự phê duyệt phần mình viết; vai trò quản lý hoặc phân tích nghiệp vụ không thay thế review kỹ thuật và kiểm thử.

Hình cơ cấu phối hợp có thể giữ nguyên. Nếu ghi rõ ngay trên hình, đổi nhãn PM thành “PM (kiêm hỗ trợ Backend)” và BA thành “BA (kiêm hỗ trợ UI/Frontend)”; không thêm thành viên hoặc vẽ thêm sơ đồ.

## 2. Task 1.5.2: bổ sung một câu về trách nhiệm PM

Vị trí: trang in 18, cuối mục “Project Manager”, sau các trách nhiệm quản lý của Nguyễn Đăng Khoa.

> Ngoài trách nhiệm quản lý, Nguyễn Đăng Khoa kiêm hỗ trợ một số tác vụ Backend theo phân công tại Mục 1.7.1; thời gian này được tính chung vào tải công việc của thành viên PM và không thay đổi thẩm quyền phê duyệt, nghiệm thu đã xác định.

Giữ nguyên Client, Project Authority, trách nhiệm ra quyết định và cơ chế escalation ở Task 1.5.

## 3. Task 1.2.4: thêm giả định năng lực để phương án có căn cứ

Vị trí: trang in 8, cuối “Major Assumptions”. Đây là giả định cần nhóm xác nhận trước khi chốt kế hoạch:

> Phương án giả định PM có kiến thức nền Java Spring Boot và BA có khả năng thiết kế UI, lập trình Angular ở các màn hình được phân công. Nhóm xác nhận năng lực và thời gian tham gia trước khi chốt baseline. Nếu cần thời gian học công nghệ đáng kể thì bổ sung vào ước lượng hoặc điều chỉnh người thực hiện; không phân việc chỉ để làm bằng số giờ.

Giữ giới hạn 5 thành viên và yêu cầu xét lịch học, thời gian tham gia thực tế ở Task 1.2.5.

## 4. Task 1.3.4: làm rõ phạm vi của dự toán sơ bộ

Giữ bảng dự toán sơ bộ 480 giờ công và đơn giá công sức hiện có. Bổ sung sau bảng dự toán:

> Dự toán 480 giờ công tại Task 1 là ước lượng sơ bộ cho toàn bộ dự án. Task 2.6 sử dụng phương pháp bottom-up để ước lượng chi tiết phần việc còn lại từ hoàn thiện kế hoạch đến bàn giao, với tổng cơ sở 320,5 giờ công. Hai con số có phạm vi và thời điểm lập khác nhau; phần chênh lệch không được coi là công sức thực tế đã thực hiện. Nhóm lưu các bản kế hoạch để đối chiếu với dữ liệu thực tế và giải thích điều chỉnh khi có căn cứ. Phần đáp ứng rủi ro và lịch khả thi tiếp tục được hoàn thiện tại Task 2.8-2.11.

Các hàng chi phí ở Task 1 là hạng mục công việc, không phải số giờ độc quyền của từng người. Việc chuyển người thực hiện không tự làm thay đổi tổng effort ở cùng phạm vi và đơn giá. Nếu Task 1 đã được duyệt, ghi phần giải thích này trong lần cập nhật có lưu vết.

## 5. Các phần giữ nguyên về nội dung cốt lõi

- **Task 1.1:** không sửa câu hỏi, câu trả lời hoặc lịch sử Client Interaction Log chỉ vì thay đổi phân công nội bộ.
- **Task 1.3.4:** giữ số liệu dự toán sơ bộ; bổ sung phần giải thích phạm vi ở Mục 4 của hướng dẫn này.
- **Task 1.4:** giữ mục tiêu, phạm vi MVP, exclusions và các chỉ số hiệu quả.
- **Task 1.6:** giữ stakeholder và chiến lược tham gia; PM và BA kiêm nhiệm vẫn thuộc cùng nhóm dự án.
- **Task 1.7.2:** giữ quy trình GitHub/PR, peer review và Definition of Done.
- **Task 1.7.3:** giữ 2 buổi họp mỗi tuần, khoảng 30 phút/buổi; bổ sung cách tổ chức demo I1 và lấy phản hồi theo Mục 7 dưới đây.
- **Task 1.8:** giữ Incremental Development và phạm vi ba increment; làm rõ mốc phản hồi của bản thử nghiệm I1 theo Mục 7.

480 giờ ở Task 1.3 là dự toán sơ bộ toàn dự án; 320,5 giờ ở Task 2.6 là ước lượng chi tiết cho phần việc còn lại. Không coi chênh lệch 159,5 giờ là actual đã thực hiện. Khi có số liệu thực tế, nhóm đối chiếu hai phạm vi và giải thích điều chỉnh nếu cần.

## 6. Đối chiếu với Task 2.6 sau sửa

Phần hỗ trợ đã được gắn trực tiếp vào các dòng bottom-up, không chỉ chuyển số ở bảng tổng:

| Hoạt động | Phần việc kiêm nhiệm | Người nhận | Giờ công |
|---|---|---|---:|
| A03 | Cấu hình dịch vụ email và biến môi trường liên quan | PM | 2 |
| A04 | Viết và tự kiểm tra dữ liệu seed giả lập | PM | 2 |
| A05 | Lập trình quản lý sự kiện và unit test phần phụ trách | PM | 6 |
| A07 | Lập trình đăng ký/hủy 6h + tích hợp email 4h, gồm unit test phần phụ trách | PM | 10 |
| A09 | Lập trình điểm danh thủ công và unit test phần phụ trách | PM | 4 |
| A10 | Lập trình xuất CSV/Excel và unit test phần phụ trách | PM | 4 |
| **Cộng hỗ trợ Backend** | | **PM** | **28** |
| A01 | Thiết kế mockups ba vai trò; FE giữ 1h review | BA | 5 |
| A05 | Lập trình UI tài khoản/phân quyền và unit test | BA | 6 |
| A10 | Lập trình UI báo cáo/tải tệp và unit test | BA | 4 |
| **Cộng hỗ trợ UI/Frontend** | | **BA** | **15** |

| Thành viên, nhận diện bằng vai trò chính | Giờ công cơ sở sau phân công |
|---|---:|
| PM, kiêm hỗ trợ Backend | 65 |
| BA, kiêm hỗ trợ UI/Frontend | 61,5 |
| BE | 65,5 |
| FE | 62 |
| QA | 66,5 |
| **Tổng** | **320,5** |

Mức chênh lệch cơ sở cao nhất - thấp nhất còn 5 giờ công. So với phương án ban đầu chưa kiêm nhiệm: PM tăng 28h, BA tăng 15h; BE giảm 28h, FE giảm 15h. Tổng từng hoạt động và tổng 320,5h giữ nguyên; phần việc và người review đã được cập nhật trong các dòng bottom-up.

G08 vẫn có điều kiện, thêm 2 giờ PM và 2 giờ FE nếu kích hoạt; tổng khi có G08 là 324,5 giờ công. Các số là planned effort, chưa phải actual và chưa xác nhận lịch khả thi. Ở Task 2.10-2.11, cộng công việc chính và kiêm nhiệm trong cùng lịch của mỗi người; xét cả availability, năng lực và thời gian chờ.

## 7. Đồng bộ việc demo bản thử nghiệm và lấy phản hồi

### 7.1. Task 1.7.3 - Meeting Cadence và Bảng 11, trang 25

Giữ hai buổi họp mỗi tuần, trung bình 30 phút/buổi. Bổ sung ngay sau đoạn mô tả tần suất họp:

> Sau khi Increment 1 hoàn thành kiểm thử, nhóm dự kiến sử dụng một buổi họp định kỳ để trình diễn bản thử nghiệm cho thầy Nguyễn Minh Tâm, với vai trò đại diện khách hàng, tại checkpoint CP1. PM thống nhất lịch demo, BA tổng hợp câu hỏi nghiệp vụ và cùng PM ghi nhận phản hồi vào Client Interaction Log. Nhóm gửi liên kết bản demo, phiên bản/build và các nội dung cần xác nhận qua Gmail; trao đổi trực tiếp có thể thực hiện qua Google Meet theo lịch đã thống nhất. Các phản hồi được đánh giá tác động trước khi điều chỉnh sản phẩm.

Trong Bảng 11, bổ sung một dòng để thể hiện kênh trao đổi với đại diện khách hàng:

| Kênh | Tần suất | Mục đích sử dụng | Nơi ghi nhận |
|---|---|---|---|
| Gmail; Google Meet khi đã thống nhất lịch | Tại CP1 sau kiểm thử I1 và khi cần xác nhận yêu cầu/thay đổi | Gửi bản demo và câu hỏi cần xác nhận; tiếp nhận phản hồi, làm rõ tác động và quyết định | Client Interaction Log trên Confluence; liên kết email/biên bản tương ứng |

Task 2.6 dự toán G05 gồm 10 buổi họp trong 5 chu kỳ; buổi demo CP1 nằm trong một buổi đã tính, với giả định thời lượng 30 phút. PM tổng hợp biên bản trong giờ G05; PM/BA cập nhật Client Interaction Log trong G06. Nếu phải tổ chức thêm buổi riêng hoặc phát sinh sửa đổi lớn, đánh giá lại effort và lịch; không mặc định mọi trao đổi đều đã được bao phủ.

### 7.2. Task 1.8.4 - sau Bảng 16, trang 31

Thêm đoạn sau bảng định hướng ba phần phát triển, trước đoạn nói về kiểm thử sau tích hợp:

> Bản Increment 1 đã kiểm thử được sử dụng làm bản thử nghiệm để trình diễn và lấy phản hồi từ đại diện khách hàng tại CP1. Nhóm ghi nhận các nhận xét về giao diện, luồng thao tác và mức độ đáp ứng yêu cầu. Lỗi thuộc phạm vi đã thống nhất được sửa và kiểm thử lại trong hoạt động tương ứng. Phản hồi làm thay đổi phạm vi, tiêu chí nghiệm thu hoặc baseline phải được phân tích tác động và trình duyệt theo cơ chế tại Mục 1.5 trước khi thực hiện. Các increment tiếp theo kế thừa phiên bản đã được kiểm chứng và các điều chỉnh được chấp thuận.

Giữ nội dung kiểm thử nội bộ sau mỗi increment. CP1 bổ sung mốc trao đổi cụ thể; thẩm quyền nghiệm thu cuối cùng vẫn theo Task 1.5 và checkpoint CP4/CP6 của Task 2.5.

### 7.3. Client Interaction Log

Giữ nguyên lịch sử trao đổi đã có ở Task 1.1. Khi việc demo và trao đổi thực sự diễn ra, bổ sung ngày, liên kết/build demo, câu hỏi, phản hồi nhận được và tác động đến dự án. Nếu đang chờ phản hồi, ghi đúng trạng thái chờ; chỉ ghi quyết định hoặc phê duyệt sau khi có xác nhận.

## 8. Kiểm tra nhanh trước khi ghép báo cáo

- Nhóm vẫn gồm 5 người; PM và BA là hai người riêng biệt, có phần việc kỹ thuật kiêm nhiệm được nêu rõ.
- PM hỗ trợ Backend 28h; BA hỗ trợ UI/Frontend 15h; tổng cơ sở theo người là 65h, 61,5h, 65,5h, 62h và 66,5h.
- Tổng phần việc còn lại là 320,5 giờ công; G08 có điều kiện là 4 giờ công. Đây chưa phải tổng có đầy đủ đáp ứng rủi ro ở Task 2.8-2.9.
- Ghi thống nhất CP1 sau A06; demo bản I1 đã kiểm thử và ghi nhận phản hồi trước khi điều chỉnh.
- Giữ tần suất hai buổi 30 phút/tuần; buổi demo CP1 nằm trong dự toán G05, cập nhật trao đổi thuộc G06.
- Đơn vị giờ công được phân biệt với thời gian lịch. Tải trung bình khoảng 12,3-13,3 giờ/người/tuần là cơ sở lập lịch, chưa thay thế kiểm tra availability và phụ thuộc ở Task 2.10-2.11.
- Phạm vi MVP, exclusions, stakeholder, tiêu chí hiệu quả và thẩm quyền phê duyệt của Task 1 được giữ nhất quán với Task 2.

Nếu Task 1 đã được duyệt làm baseline, ghi nhận bổ sung phân công và lý do giảm tải BE/FE trong lịch sử thay đổi, giữ bản đã duyệt để đối chiếu.
