import AnimatedBackground from "../components/AnimatedBackground";

export default function About() {
  const keyFeatures = [
    "Bản đồ tương tác theo vị trí thực, hiển thị POI theo khu vực người dùng đang khám phá.",
    "Tự động phát thuyết minh khi người dùng đi vào vùng bán kính của POI.",
    "Hỗ trợ đa ngôn ngữ cho nội dung và audio, đáp ứng khách nội địa lẫn quốc tế.",
    "Tìm kiếm nhanh theo tên/mô tả địa điểm, hỗ trợ trải nghiệm khám phá liên tục.",
    "Quét QR để mở nhanh đường dẫn audio của từng POI tại điểm bán hoặc biển chỉ dẫn.",
    "Phân quyền người dùng rõ ràng: USER, PARTNER, ADMIN cho vận hành thực tế.",
  ];

  const technologies = [
    "Frontend: React, React Router, Tailwind CSS, Lucide Icons, React Leaflet.",
    "Backend API: Node.js + Express + TypeScript, chuẩn REST cho web/mobile.",
    "Dữ liệu: Prisma ORM + PostgreSQL, quản lý schema và migration nhất quán.",
    "Định vị & geofence: Leaflet map + tính toán khoảng cách theo tọa độ thực.",
    "Âm thanh: TTS preview và quản lý audio URL theo từng ngôn ngữ nội dung.",
    "Bảo mật & vận hành: JWT auth, phân quyền theo role, audit các thao tác admin.",
  ];

  return (
    <div className="relative w-full min-h-full overflow-hidden">
      <AnimatedBackground />
      <div className="relative z-10 min-h-full flex flex-col justify-center items-center p-6">
        <div className="w-full max-w-3xl rounded-3xl border border-white/60 bg-white/82 backdrop-blur-xl shadow-[0_24px_80px_rgba(15,23,42,0.16)] p-8 md:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-orange-500 mb-3">
            Về hệ thống
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-6">
            Phố Ẩm Thực
          </h1>
          <div className="space-y-4 text-slate-700 leading-relaxed">
            <p>
              Phố Ẩm Thực là hệ thống dẫn dắt trải nghiệm ẩm thực theo vị trí,
              giúp người dùng khám phá địa điểm trên bản đồ và nghe thuyết minh
              tự động theo từng POI. Nền tảng được thiết kế để phục vụ cả trải
              nghiệm du lịch, giới thiệu món ăn và quản trị nội dung tập trung.
            </p>

            <h2 className="text-2xl font-semibold text-blue-600 mt-8 mb-3">
              Tính năng nổi bật
            </h2>
            <ul className="list-disc list-inside space-y-2 text-slate-600">
              {keyFeatures.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h2 className="text-2xl font-semibold text-orange-500 mt-8 mb-3">
              Công nghệ đã ứng dụng
            </h2>
            <ul className="list-disc list-inside space-y-2 text-slate-600">
              {technologies.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
