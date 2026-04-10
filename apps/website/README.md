# Phố Ẩm Thực Website Docs

Tài liệu này mô tả nhanh cấu trúc website, các chức năng chính, và vị trí của những hàm quan trọng trong từng file. Mục tiêu là để người mới vào codebase có thể lần ra đúng file, đúng handler, đúng luồng xử lý mà không phải đọc lại toàn bộ source.

## Cách chạy nhanh

- `npm run dev` để chạy frontend ở chế độ phát triển.
- `npm run build` để build production.
- `npm run lint` để kiểm tra lint.
- `npm run preview` để xem bản build local.

## Kiến trúc tổng quan

- Ứng dụng được khởi động từ [src/main.jsx](src/main.jsx#L1), nơi bọc toàn bộ app bằng `ToastProvider`, `LanguageProvider` và `BrowserRouter`.
- Layout gốc và thanh điều hướng nằm ở [src/App.jsx](src/App.jsx#L17); file này cũng quyết định khi nào hiển thị navbar và khi nào hiển thị bản đồ nền.
- Danh sách route được khai báo tại [src/routes/index.jsx](src/routes/index.jsx#L1).
- Bản đồ, geofence, tìm kiếm POI và autoplay audio nằm chủ yếu trong [src/components/MapComponent.jsx](src/components/MapComponent.jsx#L83).
- Luồng partner tạo/sửa/xóa POI, tạo QR và sinh audio preview nằm trong [src/pages/PartnerProfile.jsx](src/pages/PartnerProfile.jsx#L64).
- Luồng admin quản lý POI, user, partner request và khóa/mở tài khoản nằm trong [src/pages/AdminDashboard.jsx](src/pages/AdminDashboard.jsx#L245).

## Entry point

- [src/main.jsx](src/main.jsx#L1): bootstrap React app, mount `App`, và bọc provider cho ngôn ngữ + toast. Đây là điểm bắt đầu của toàn bộ website.
- [src/App.jsx](src/App.jsx#L17): `App` điều phối navbar, logout, route rendering, và bản đồ nền. Hàm đáng chú ý là `handleLogout` trong cùng file để xóa token và điều hướng về `/login`.
- [src/routes/index.jsx](src/routes/index.jsx#L1): mapping route sang page component. Đây là nơi tra nhanh đường dẫn nào mở component nào.

## Trang công khai

- [src/pages/Home.jsx](src/pages/Home.jsx#L10): `featured` (`useMemo`) chuẩn hóa dữ liệu theo ngôn ngữ hiện tại, còn `fetchFeatured` (`useEffect`) gọi API lấy POI/tour nổi bật.
- [src/pages/About.jsx](src/pages/About.jsx#L3): trang giới thiệu hệ thống; hiện phần nội dung là tĩnh, không có handler phức tạp.
- [src/pages/Login.jsx](src/pages/Login.jsx#L8): `handleSubmit` gửi đăng nhập, lưu token, lưu role và điều hướng theo role sau khi login thành công.
- [src/pages/Register.jsx](src/pages/Register.jsx#L6): `handleChange`, `validateForm`, `handleSubmit` xử lý form đăng ký và kiểm tra dữ liệu đầu vào trước khi gọi API.
- [src/pages/NotFound.jsx](src/pages/NotFound.jsx#L4): trang 404; không có logic nghiệp vụ, chỉ là fallback route.

## Hồ sơ người dùng

- [src/pages/Profile.jsx](src/pages/Profile.jsx#L20): `formatDate` format thời gian tạo hồ sơ theo locale đang chọn.
- [src/pages/Profile.jsx](src/pages/Profile.jsx#L83): `handleUpdateName` cập nhật tên hiển thị.
- [src/pages/Profile.jsx](src/pages/Profile.jsx#L114): `handleChangePassword` đổi mật khẩu, xóa token cũ và ép đăng nhập lại.
- [src/pages/Profile.jsx](src/pages/Profile.jsx#L20): file này cũng dùng `useLanguage`, `useTranslation` và `useToast` để đồng bộ ngôn ngữ và thông báo.

## Trang đối tác

- [src/pages/PartnerProfile.jsx](src/pages/PartnerProfile.jsx#L64): component chính của trang đối tác.
- [src/pages/PartnerProfile.jsx](src/pages/PartnerProfile.jsx#L173): `loadProfile` tải thông tin user hiện tại.
- [src/pages/PartnerProfile.jsx](src/pages/PartnerProfile.jsx#L189): `loadPartnerData` tải danh sách POI của đối tác.
- [src/pages/PartnerProfile.jsx](src/pages/PartnerProfile.jsx#L205): `loadPartnerRegistrationData` tải lịch sử yêu cầu đăng ký đối tác.
- [src/pages/PartnerProfile.jsx](src/pages/PartnerProfile.jsx#L286): `handleSubmitPartnerRegistration` gửi yêu cầu trở thành PARTNER.
- [src/pages/PartnerProfile.jsx](src/pages/PartnerProfile.jsx#L325): `handleCreatePoiRequest` tạo POI hoặc cập nhật POI; sau khi tạo mới thì sinh QR từ `createdPoiId` và tải về file PNG.
- [src/pages/PartnerProfile.jsx](src/pages/PartnerProfile.jsx#L438): `handleMapPick` nhận tọa độ từ bản đồ và đổ vào form POI.
- [src/pages/PartnerProfile.jsx](src/pages/PartnerProfile.jsx#L443): `handlePickImage` validate file ảnh và tạo preview.
- [src/pages/PartnerProfile.jsx](src/pages/PartnerProfile.jsx#L468): `handleGenerateAudioPreview` gọi TTS preview từ mô tả POI.
- [src/pages/PartnerProfile.jsx](src/pages/PartnerProfile.jsx#L502): `handleDeletePoi` xóa POI sau khi confirm bằng `window.confirm`.
- [src/pages/PartnerProfile.jsx](src/pages/PartnerProfile.jsx#L223) và [src/pages/PartnerProfile.jsx](src/pages/PartnerProfile.jsx#L278): các `useEffect` này tự load profile và tự chuyển chế độ PARTNER/không-PARTNER.
- [src/pages/PartnerProfile.jsx](src/pages/PartnerProfile.jsx#L64): QR list của partner được dựng lại từ `pois` bằng `QRCode.toDataURL(String(poi.id))`, nên mã QR hiện tại chứa ID POI, không chứa link audio.

## Bản đồ và POI

- [src/pages/Map.jsx](src/pages/Map.jsx#L3): wrapper rất mỏng, chỉ render `MapComponent`.
- [src/components/MapComponent.jsx](src/components/MapComponent.jsx#L83): component chính cho bản đồ.
- [src/components/MapComponent.jsx](src/components/MapComponent.jsx#L43): `resolvePrimaryAudioUrl` chọn audio URL phù hợp theo ngôn ngữ.
- [src/components/MapComponent.jsx](src/components/MapComponent.jsx#L55): `calculateDistanceMeters` tính khoảng cách giữa 2 tọa độ để kiểm tra geofence.
- [src/components/MapComponent.jsx](src/components/MapComponent.jsx#L73): `MapClickHandler` bắt sự kiện click trên bản đồ.
- [src/components/MapComponent.jsx](src/components/MapComponent.jsx#L136): `fetchPOIsByBounds` gọi API lấy POI theo bounding box bản đồ.
- [src/components/MapComponent.jsx](src/components/MapComponent.jsx#L186): `filteredPOIs` lọc danh sách theo từ khóa tìm kiếm.
- [src/components/MapComponent.jsx](src/components/MapComponent.jsx#L299): `focusPOI` focus camera vào POI được chọn.
- [src/components/MapComponent.jsx](src/components/MapComponent.jsx#L310): `handleMapClick` di chuyển vị trí người dùng, flyTo điểm click, rồi kiểm tra POI nào nằm trong bán kính để mở panel và phát audio.
- [src/components/MapComponent.jsx](src/components/MapComponent.jsx#L83): phần geolocation watchPosition trong cùng component là nơi phát hiện người dùng đi vào vùng POI và kích hoạt autoplay.

## Audio player POI

- [src/components/POIDetailPanel.jsx](src/components/POIDetailPanel.jsx#L19): component panel chính cho từng POI.
- [src/components/POIDetailPanel.jsx](src/components/POIDetailPanel.jsx#L34): `handlePlayPause` bật/tắt phát audio.
- [src/components/POIDetailPanel.jsx](src/components/POIDetailPanel.jsx#L47): `handleSpeedChange` đổi tốc độ phát.
- [src/components/POIDetailPanel.jsx](src/components/POIDetailPanel.jsx#L67): `handleProgressChange` kéo thanh timeline.
- [src/components/POIDetailPanel.jsx](src/components/POIDetailPanel.jsx#L75): `handleSkip` tua lùi/tua tới theo số giây.
- [src/components/POIDetailPanel.jsx](src/components/POIDetailPanel.jsx#L90): `handleVolumeChange` chỉnh âm lượng.
- [src/components/POIDetailPanel.jsx](src/components/POIDetailPanel.jsx#L106): `tryPlayAudio` xử lý autoplay và retry khi media chưa sẵn sàng.
- [src/components/POIDetailPanel.jsx](src/components/POIDetailPanel.jsx#L147): `useEffect` autoplay lại khi `autoPlayTrigger` thay đổi.
- [src/components/POIDetailPanel.jsx](src/components/POIDetailPanel.jsx#L192): `handleClose` dừng audio rồi đóng panel.

## Admin

- [src/pages/AdminDashboard.jsx](src/pages/AdminDashboard.jsx#L245): component dashboard chính, có sidebar menu theo section.
- [src/pages/AdminDashboard.jsx](src/pages/AdminDashboard.jsx#L246): `sidebarMenus` định nghĩa danh sách menu bên trái.
- [src/pages/AdminDashboard.jsx](src/pages/AdminDashboard.jsx#L278): `loadDashboard` tải đồng thời POI, user và partner registration requests.
- [src/pages/AdminDashboard.jsx](src/pages/AdminDashboard.jsx#L348): `handleReviewPartnerRegistrationRequest` duyệt hoặc từ chối yêu cầu partner.
- [src/pages/AdminDashboard.jsx](src/pages/AdminDashboard.jsx#L378): `executeUpdateUserRole` đổi role người dùng.
- [src/pages/AdminDashboard.jsx](src/pages/AdminDashboard.jsx#L414): `executeUpdateUserAccess` khóa hoặc mở khóa tài khoản.
- [src/pages/AdminDashboard.jsx](src/pages/AdminDashboard.jsx#L441): `setPendingUserAction` được dùng để mở popup xác nhận cho đổi role.
- [src/pages/AdminDashboard.jsx](src/pages/AdminDashboard.jsx#L449): `setPendingUserAction` được dùng để mở popup xác nhận cho khóa/mở khóa.
- [src/pages/AdminDashboard.jsx](src/pages/AdminDashboard.jsx#L749): vùng render sidebar menu và switch nội dung theo `activeSection`.
- [src/pages/AdminDashboard.jsx](src/pages/AdminDashboard.jsx#L1425): phần render popup xác nhận hành động.

## Shared components

- [src/components/LanguageSelector.jsx](src/components/LanguageSelector.jsx#L4): dropdown chọn ngôn ngữ, gọi `changeLanguage` từ context.
- [src/components/Toast.jsx](src/components/Toast.jsx#L5): render danh sách toast hiện tại.
- [src/components/AnimatedBackground.jsx](src/components/AnimatedBackground.jsx#L1): nền động cho các trang auth và about.
- [src/components/BrandLogo.jsx](src/components/BrandLogo.jsx#L4): logo có link về trang chủ.

## Hooks và context

- [src/hooks/useLanguageContext.jsx](src/hooks/useLanguageContext.jsx#L7): `SUPPORTED_LANGUAGES` khai báo các ngôn ngữ hỗ trợ.
- [src/hooks/useLanguageContext.jsx](src/hooks/useLanguageContext.jsx#L16): `LanguageProvider` quản lý language state và persist vào `localStorage`.
- [src/hooks/useLanguageContext.jsx](src/hooks/useLanguageContext.jsx#L55): `useLanguage` lấy language hiện tại từ context.
- [src/hooks/useLanguageContext.jsx](src/hooks/useLanguageContext.jsx#L64): `useTranslation` trả về bộ translation tương ứng ngôn ngữ.
- [src/hooks/useLanguageContext.jsx](src/hooks/useLanguageContext.jsx#L71): `pickLocalizedText` lấy text theo ngôn ngữ hiện tại và fallback hợp lý.
- [src/hooks/useToast.jsx](src/hooks/useToast.jsx#L5): `ToastProvider` lưu state thông báo và export các hàm `showSuccess`, `showError`, `showInfo`.
- [src/hooks/useToast.jsx](src/hooks/useToast.jsx#L40): `useToast` lấy context toast trong component con.

## API và tiện ích

- [src/lib/api.js](src/lib/api.js#L2): `resolveApiBaseUrl` xác định base URL backend từ env.
- [src/lib/api.js](src/lib/api.js#L16): `getDeviceId` tạo ID thiết bị cho login/register.
- [src/lib/api.js](src/lib/api.js#L29): `setTokens` lưu token vào `localStorage`.
- [src/lib/api.js](src/lib/api.js#L34): `authFetch` tự gắn `Authorization` cho request đã đăng nhập.
- [src/lib/api.js](src/lib/api.js#L49): `authAPI` gồm register, login, changePassword, logout và redeemClaimCode.
- [src/lib/api.js](src/lib/api.js#L103): `partnerAPI` gồm submit/list/get latest partner request, lấy POI của partner, tạo/cập nhật/xóa/upload ảnh POI.
- [src/lib/api.js](src/lib/api.js#L217): `poisAPI` gồm getAll, getById, getFeatured, searchByRadius, getByBounds.
- [src/lib/api.js](src/lib/api.js#L247): `toursAPI` gồm getAll, getById, getFeatured.
- [src/lib/apiClient.js](src/lib/apiClient.js#L9): `getDeviceId` là bản client cũ hơn, vẫn giữ cấu trúc tương tự.
- [src/lib/apiClient.js](src/lib/apiClient.js#L19): `getTokens`, [src/lib/apiClient.js](src/lib/apiClient.js#L27): `setTokens`, [src/lib/apiClient.js](src/lib/apiClient.js#L33): `clearTokens`, [src/lib/apiClient.js](src/lib/apiClient.js#L39): `authFetch`, [src/lib/apiClient.js](src/lib/apiClient.js#L70): `apiClient` là lớp client legacy với nhóm endpoint auth/poi/tour/search.
- [src/lib/jwt.js](src/lib/jwt.js#L5): `parseJwt` giải mã payload JWT ở phía frontend.
- [src/lib/jwt.js](src/lib/jwt.js#L30): `getRoleFromToken` lấy role từ JWT để hiển thị đúng menu/admin flow.
- [src/lib/jwt.js](src/lib/jwt.js#L41): `isTokenExpired` kiểm tra token hết hạn.

## Ghi chú cho người sửa code

- Khi sửa luồng auth hoặc role, luôn kiểm tra cả [src/App.jsx](src/App.jsx#L17), [src/lib/jwt.js](src/lib/jwt.js#L30) và [src/pages/Login.jsx](src/pages/Login.jsx#L16).
- Khi sửa geofence hoặc autoplay, thường phải chạm cả [src/components/MapComponent.jsx](src/components/MapComponent.jsx#L310) và [src/components/POIDetailPanel.jsx](src/components/POIDetailPanel.jsx#L106).
- Khi sửa chức năng partner tạo POI, hãy xem cả [src/pages/PartnerProfile.jsx](src/pages/PartnerProfile.jsx#L325), [src/pages/PartnerProfile.jsx](src/pages/PartnerProfile.jsx#L468) và [src/lib/api.js](src/lib/api.js#L103).
- Khi sửa thông báo UI, `ToastProvider` ở [src/hooks/useToast.jsx](src/hooks/useToast.jsx#L5) và renderer ở [src/components/Toast.jsx](src/components/Toast.jsx#L5) cần đi cùng nhau.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
