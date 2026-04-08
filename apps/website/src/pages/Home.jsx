export default function Home() {
  return (
    <div className="w-full min-h-screen flex flex-col justify-center items-center p-6">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md text-center backdrop-blur-sm">
        <h1 className="text-4xl font-bold text-blue-600 mb-4">Phố Ẩm Thực</h1>
        <p className="text-lg text-gray-600 mb-6">
          Location-Based Food Narration System
        </p>
        <p className="text-sm text-gray-500">
          Explore restaurants on the map and listen to multi-language narrations
          when you tap a point of interest or scan a QR code.
        </p>
      </div>
    </div>
  );
}
