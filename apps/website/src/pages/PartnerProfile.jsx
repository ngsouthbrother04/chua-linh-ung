import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useTranslation } from "../hooks/useLanguageContext";
import { useToast } from "../hooks/useToast";
import { ttsAPI } from "../lib/api";

function formatSubmittedAt(isoValue) {
  if (!isoValue) return "-";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function clampCoordinate(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(min, Math.min(max, number));
}

function CoordinatePicker({ onPick, markerPosition }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });

  if (!markerPosition) return null;

  const markerIcon = new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  return <Marker position={markerPosition} icon={markerIcon} />;
}

export default function PartnerProfile() {
  const t = useTranslation();
  const { showSuccess, showError } = useToast();
  const token = localStorage.getItem("accessToken");

  const [draft, setDraft] = useState(() => {
    const raw = localStorage.getItem("partnerRequestDraft");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  const [points, setPoints] = useState(() => {
    const raw = localStorage.getItem("partnerPointsDraft");
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pointName, setPointName] = useState("");
  const [pointAddress, setPointAddress] = useState("");
  const [pointDescription, setPointDescription] = useState("");
  const [pointCategory, setPointCategory] = useState("FOOD");
  const [coordinateMode, setCoordinateMode] = useState("manual");
  const [latitudeInput, setLatitudeInput] = useState("10.762622");
  const [longitudeInput, setLongitudeInput] = useState("106.660172");
  const [imagePreview, setImagePreview] = useState("");
  const [imageName, setImageName] = useState("");
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState("");
  const [audioGeneratedWith, setAudioGeneratedWith] = useState("");
  const [audioError, setAudioError] = useState("");
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isCreatingPoint, setIsCreatingPoint] = useState(false);
  const [editingPointId, setEditingPointId] = useState(null);
  const [isPoiModalOpen, setIsPoiModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("partnerPointsDraft", JSON.stringify(points));
  }, [points]);

  useEffect(() => {
    if (!generatedAudioUrl) return;
    return () => {
      URL.revokeObjectURL(generatedAudioUrl);
    };
  }, [generatedAudioUrl]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const isPending = draft?.status === "PENDING_UI_ONLY";
  const isApproved = draft?.status === "APPROVED_UI_ONLY";

  const totalVisitors = points.reduce(
    (sum, item) => sum + Number(item.visitors || 0),
    0,
  );

  const thisWeekVisitors =
    points.length === 0
      ? 0
      : points.reduce(
          (sum, item) => sum + Math.round(Number(item.visitors || 0) * 0.22),
          0,
        );

  const handleSubmit = (e) => {
    e.preventDefault();

    const trimmedShopName = shopName.trim();
    const trimmedAddress = address.trim();

    if (!trimmedShopName || !trimmedAddress) {
      showError("Vui lòng nhập tên quán và địa chỉ.");
      return;
    }

    setIsSubmitting(true);
    const payload = {
      shopName: trimmedShopName,
      address: trimmedAddress,
      submittedAt: new Date().toISOString(),
      status: "PENDING_UI_ONLY",
    };

    localStorage.setItem("partnerRequestDraft", JSON.stringify(payload));
    setDraft(payload);
    showSuccess("Đã gửi yêu cầu đối tác. Trạng thái: chờ duyệt (UI).");

    setTimeout(() => {
      setIsSubmitting(false);
    }, 350);
  };

  const handleApproveUi = () => {
    if (!draft) return;

    const approved = {
      ...draft,
      status: "APPROVED_UI_ONLY",
      approvedAt: new Date().toISOString(),
    };

    localStorage.setItem("partnerRequestDraft", JSON.stringify(approved));
    setDraft(approved);
    showSuccess(
      "Đã chuyển sang trạng thái đối tác (UI). Bạn có thể tạo point ngay.",
    );
  };

  const handlePickImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(String(reader.result || ""));
      setImageName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateAudio = async () => {
    const text = pointDescription.trim();
    if (!text) {
      showError("Vui lòng nhập mô tả để tạo audio test.");
      return;
    }

    setIsGeneratingAudio(true);

    try {
      const { audioUrl } = await ttsAPI.previewFromText(text, "vi");
      if (generatedAudioUrl) {
        URL.revokeObjectURL(generatedAudioUrl);
      }

      setGeneratedAudioUrl(audioUrl);
      setAudioGeneratedWith("server");
      setAudioError("");
      showSuccess("Đã tạo audio test từ backend TTS.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Không thể tạo audio test từ backend.";
      setAudioError(message);
      setGeneratedAudioUrl("");
      setAudioGeneratedWith("");
      showError(`Tạo audio thất bại: ${message}`);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleMapPick = (lat, lng) => {
    setLatitudeInput(lat.toFixed(6));
    setLongitudeInput(lng.toFixed(6));
  };

  const resetPointForm = () => {
    setEditingPointId(null);
    setPointName("");
    setPointAddress("");
    setPointDescription("");
    setPointCategory("FOOD");
    setLatitudeInput("10.762622");
    setLongitudeInput("106.660172");
    setImagePreview("");
    setImageName("");
    setGeneratedAudioUrl("");
    setAudioGeneratedWith("");
    setAudioError("");
  };

  const closePoiModal = () => {
    setIsPoiModalOpen(false);
    resetPointForm();
  };

  const handleStartEditPoint = (point) => {
    setEditingPointId(point.id);
    setIsPoiModalOpen(true);
    setPointName(point.name || "");
    setPointAddress(point.address || "");
    setPointDescription(point.description || "");
    setPointCategory(point.category || "FOOD");
    setLatitudeInput(
      typeof point.latitude === "number"
        ? point.latitude.toFixed(6)
        : "10.762622",
    );
    setLongitudeInput(
      typeof point.longitude === "number"
        ? point.longitude.toFixed(6)
        : "106.660172",
    );
    setImagePreview(point.image || "");
    setImageName(point.imageName || "");
    setGeneratedAudioUrl("");
    setAudioGeneratedWith("");
    setAudioError("");
  };

  const handleDeletePoint = (pointId) => {
    setPoints((prev) => prev.filter((item) => item.id !== pointId));

    if (editingPointId === pointId) {
      resetPointForm();
    }

    showSuccess("Đã xóa point (UI).");
  };

  const handleCreatePoint = (e) => {
    e.preventDefault();

    const trimmedName = pointName.trim();
    const trimmedAddress = pointAddress.trim();
    const trimmedDescription = pointDescription.trim();
    const latitude = clampCoordinate(latitudeInput, -90, 90);
    const longitude = clampCoordinate(longitudeInput, -180, 180);

    if (!trimmedName || !trimmedAddress || !trimmedDescription) {
      showError("Vui lòng nhập tên điểm, địa chỉ và mô tả.");
      return;
    }

    if (latitude === null || longitude === null) {
      showError(
        "Tọa độ không hợp lệ. Vui lòng nhập lại hoặc chọn trên bản đồ.",
      );
      return;
    }

    setIsCreatingPoint(true);

    if (editingPointId) {
      setPoints((prev) =>
        prev.map((item) => {
          if (item.id !== editingPointId) return item;

          return {
            ...item,
            name: trimmedName,
            address: trimmedAddress,
            description: trimmedDescription,
            category: pointCategory,
            latitude,
            longitude,
            image: imagePreview || null,
            imageName: imageName || null,
            hasAudioPreview: Boolean(generatedAudioUrl) || item.hasAudioPreview,
            updatedAt: new Date().toISOString(),
          };
        }),
      );
      showSuccess("Cập nhật point thành công (UI).");
    } else {
      const nextPoint = {
        id: `poi-${Date.now()}`,
        name: trimmedName,
        address: trimmedAddress,
        description: trimmedDescription,
        category: pointCategory,
        latitude,
        longitude,
        image: imagePreview || null,
        imageName: imageName || null,
        hasAudioPreview: Boolean(generatedAudioUrl),
        createdAt: new Date().toISOString(),
        visitors: Math.floor(Math.random() * 120) + 15,
      };

      setPoints((prev) => [nextPoint, ...prev]);
      showSuccess("Tạo point thành công (UI).");
    }

    closePoiModal();

    setTimeout(() => {
      setIsCreatingPoint(false);
    }, 300);
  };

  const markerPosition =
    clampCoordinate(latitudeInput, -90, 90) !== null &&
    clampCoordinate(longitudeInput, -180, 180) !== null
      ? [Number(latitudeInput), Number(longitudeInput)]
      : null;

  return (
    <div className="w-full min-h-full bg-slate-50 p-4 md:p-6">
      <div className="h-full w-full rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm md:p-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-emerald-600">
          PARTNER
        </p>
        <h1 className="mb-6 text-3xl font-black text-slate-900">
          Đăng ký đối tác
        </h1>

        <div className="mb-4">
          <Link
            to="/profile"
            className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Quay lại hồ sơ
          </Link>
        </div>

        {!isPending && !isApproved && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-2xl border border-slate-200 bg-white p-4"
          >
            <p className="mb-3 text-sm font-semibold text-slate-900">
              Thông tin đăng ký đối tác
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Tên quán"
                className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500"
              />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Địa chỉ"
                className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500"
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Bản này chỉ là UI, trạng thái sẽ lưu local.
              </p>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {isSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
              </button>
            </div>
          </form>
        )}

        {isPending && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="text-sm font-semibold">
              Yêu cầu đã gửi - đang chờ duyệt
            </p>
            <p className="mt-1 text-xs">
              Bản hiện tại là UI-only. Bạn có thể mô phỏng duyệt để xem giao
              diện đối tác.
            </p>
            <button
              type="button"
              onClick={handleApproveUi}
              className="mt-3 inline-flex h-10 items-center rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              Mô phỏng duyệt đối tác
            </button>
          </div>
        )}

        {isApproved && (
          <>
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <p className="text-sm font-semibold">
                Tài khoản đối tác đã được duyệt (UI)
              </p>
              <p className="mt-1 text-xs">
                Bạn có thể tạo POI và xem thống kê lượt truy cập ngay bên dưới.
              </p>
            </div>

            <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Tổng Point
                </p>
                <p className="mt-2 text-3xl font-black text-slate-900">
                  {points.length}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Tổng lượt truy cập
                </p>
                <p className="mt-2 text-3xl font-black text-slate-900">
                  {totalVisitors}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Tuần này
                </p>
                <p className="mt-2 text-3xl font-black text-slate-900">
                  {thisWeekVisitors}
                </p>
              </div>
            </section>

            <div className="mb-6 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  resetPointForm();
                  setIsPoiModalOpen(true);
                }}
                className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Tạo POI mới
              </button>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t.nav.profile}
            </p>
            <p className="text-sm font-medium text-slate-800">
              {isApproved ? "PARTNER" : isPending ? "PENDING" : "USER"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tên quán
            </p>
            <p className="text-sm font-medium text-slate-800">
              {draft?.shopName || "-"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2 xl:col-span-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Địa chỉ quán
            </p>
            <p className="text-sm font-medium text-slate-800">
              {draft?.address || "-"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2 xl:col-span-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Thời gian gửi yêu cầu
            </p>
            <p className="text-sm font-medium text-slate-800">
              {formatSubmittedAt(draft?.submittedAt)}
            </p>
          </div>

          {isApproved && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2 xl:col-span-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Danh sách point đã tạo (UI)
              </p>
              {points.length === 0 ? (
                <p className="text-sm text-slate-600">Chưa có point nào.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 pr-4 font-semibold">Ảnh</th>
                        <th className="py-2 pr-4 font-semibold">Tên point</th>
                        <th className="py-2 pr-4 font-semibold">Địa chỉ</th>
                        <th className="py-2 pr-4 font-semibold">Loại</th>
                        <th className="py-2 pr-4 font-semibold">Tọa độ</th>
                        <th className="py-2 pr-4 font-semibold">Audio test</th>
                        <th className="py-2 pr-4 font-semibold">
                          Lượt truy cập
                        </th>
                        <th className="py-2 pr-0 font-semibold">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {points.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-slate-100 text-slate-700 last:border-b-0"
                        >
                          <td className="py-2 pr-4">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="h-10 w-14 rounded-md object-cover"
                              />
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2 pr-4 font-medium">{item.name}</td>
                          <td className="py-2 pr-4">{item.address}</td>
                          <td className="py-2 pr-4">{item.category}</td>
                          <td className="py-2 pr-4 text-xs">
                            {typeof item.latitude === "number" &&
                            typeof item.longitude === "number"
                              ? `${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}`
                              : "-"}
                          </td>
                          <td className="py-2 pr-4 text-xs">
                            {item.hasAudioPreview ? "Đã tạo" : "Chưa"}
                          </td>
                          <td className="py-2 pr-4 font-semibold text-emerald-700">
                            {item.visitors}
                          </td>
                          <td className="py-2 pr-0">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleStartEditPoint(item)}
                                className="h-8 rounded-md border border-slate-300 px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePoint(item.id)}
                                className="h-8 rounded-md border border-rose-200 px-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                              >
                                Xóa
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isApproved && isPoiModalOpen && (
        <div
          className="fixed inset-0 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-2 pb-3 pt-16 md:px-4 md:pb-4 md:pt-24"
          style={{ zIndex: 2147483647 }}
        >
          <div className="w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-3 shadow-2xl md:max-h-[85vh] md:p-4">
            <form onSubmit={handleCreatePoint}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  {editingPointId ? "Chỉnh sửa POI (UI)" : "Tạo POI mới (UI)"}
                </p>
                <button
                  type="button"
                  onClick={closePoiModal}
                  className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Đóng
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                  type="text"
                  value={pointName}
                  onChange={(e) => setPointName(e.target.value)}
                  placeholder="Tên POI"
                  className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500"
                />
                <select
                  value={pointCategory}
                  onChange={(e) => setPointCategory(e.target.value)}
                  className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500"
                >
                  <option value="FOOD">Food</option>
                  <option value="DRINK">Drink</option>
                  <option value="SNACK">Snack</option>
                </select>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePickImage}
                  className="h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-emerald-100 file:px-3 file:py-1 file:text-emerald-800"
                />
              </div>

              <div className="mt-3">
                <input
                  type="text"
                  value={pointAddress}
                  onChange={(e) => setPointAddress(e.target.value)}
                  placeholder="Địa chỉ POI"
                  className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500"
                />
              </div>

              {imagePreview && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-slate-500">
                      Ảnh đã chọn: {imageName || "(không có tên tệp)"}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview("");
                        setImageName("");
                      }}
                      className="h-8 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Xóa ảnh
                    </button>
                  </div>
                  <img
                    src={imagePreview}
                    alt="POI preview"
                    className="h-40 w-full rounded-lg object-cover md:w-72"
                  />
                </div>
              )}

              <div className="mt-3">
                <textarea
                  value={pointDescription}
                  onChange={(e) => setPointDescription(e.target.value)}
                  placeholder="Mô tả POI"
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500"
                />
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-900">
                  Tọa độ
                </p>
                <div className="mb-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCoordinateMode("manual")}
                    className={`h-9 rounded-lg px-3 text-sm font-semibold transition ${
                      coordinateMode === "manual"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Nhập tay
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoordinateMode("map")}
                    className={`h-9 rounded-lg px-3 text-sm font-semibold transition ${
                      coordinateMode === "map"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Chọn trên map
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    type="number"
                    step="0.000001"
                    value={latitudeInput}
                    onChange={(e) => setLatitudeInput(e.target.value)}
                    placeholder="Latitude"
                    className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500"
                  />
                  <input
                    type="number"
                    step="0.000001"
                    value={longitudeInput}
                    onChange={(e) => setLongitudeInput(e.target.value)}
                    placeholder="Longitude"
                    className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500"
                  />
                </div>

                {coordinateMode === "map" && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                    <MapContainer
                      className="h-44 w-full md:h-64"
                      center={markerPosition || [10.762622, 106.660172]}
                      zoom={14}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <CoordinatePicker
                        markerPosition={markerPosition}
                        onPick={handleMapPick}
                      />
                    </MapContainer>
                  </div>
                )}
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-900">
                  Audio test từ mô tả (Backend TTS)
                </p>
                <button
                  type="button"
                  onClick={handleGenerateAudio}
                  disabled={isGeneratingAudio}
                  className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  {isGeneratingAudio ? "Đang tạo audio..." : "Tạo audio test"}
                </button>

                {audioError && (
                  <p className="mt-2 text-xs font-semibold text-rose-600">
                    Lỗi tạo audio: {audioError}
                  </p>
                )}

                {generatedAudioUrl && (
                  <div className="mt-3">
                    <p className="mb-2 text-xs font-semibold text-slate-500">
                      Nguồn audio:{" "}
                      {audioGeneratedWith === "server" ? "Backend TTS" : "-"}
                    </p>
                    <audio controls className="w-full">
                      <source src={generatedAudioUrl} type="audio/wav" />
                    </audio>
                    <div className="mt-2 flex items-center gap-2">
                      <a
                        href={generatedAudioUrl}
                        download={`poi-preview-${Date.now()}.wav`}
                        className="inline-flex h-8 items-center rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Tải audio test
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          if (generatedAudioUrl) {
                            URL.revokeObjectURL(generatedAudioUrl);
                          }
                          setGeneratedAudioUrl("");
                          setAudioGeneratedWith("");
                          setAudioError("");
                        }}
                        className="h-8 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Xóa audio test
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Dữ liệu này chỉ lưu local để demo UI, chưa kết nối backend.
                </p>
                <button
                  type="submit"
                  disabled={isCreatingPoint}
                  className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {isCreatingPoint
                    ? editingPointId
                      ? "Đang cập nhật..."
                      : "Đang tạo..."
                    : editingPointId
                      ? "Cập nhật point"
                      : "Tạo point"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
