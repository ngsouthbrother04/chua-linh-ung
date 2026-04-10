import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import QRCode from "qrcode";
import { partnerAPI, ttsAPI, usersAPI } from "../lib/api";
import { useToast } from "../hooks/useToast";

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

function pickLocalized(value) {
  if (!value || typeof value !== "object") return "-";
  return value.vi || value.en || Object.values(value)[0] || "-";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function getApprovalStatusBadge(status) {
  if (status === "APPROVED") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (status === "REJECTED") {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export default function PartnerProfile() {
  const { showSuccess, showError } = useToast();
  const token = localStorage.getItem("accessToken");

  const [profile, setProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState("");

  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [registrationNote, setRegistrationNote] = useState("");
  const [isSubmittingRegistration, setIsSubmittingRegistration] =
    useState(false);
  const [partnerRegistrationRequests, setPartnerRegistrationRequests] =
    useState([]);
  const [isLoadingRegistrationRequests, setIsLoadingRegistrationRequests] =
    useState(false);

  const [pois, setPois] = useState([]);
  const [poiQrMap, setPoiQrMap] = useState({});
  const [isLoadingPartnerData, setIsLoadingPartnerData] = useState(false);

  const [isPoiModalOpen, setIsPoiModalOpen] = useState(false);
  const [editingPoiId, setEditingPoiId] = useState(null);
  const [pointName, setPointName] = useState("");
  const [pointDescription, setPointDescription] = useState("");
  const [pointCategory, setPointCategory] = useState("FOOD");
  const [latitudeInput, setLatitudeInput] = useState("10.762622");
  const [longitudeInput, setLongitudeInput] = useState("106.660172");
  const [radiusInput, setRadiusInput] = useState("120");
  const [isCreatingPoi, setIsCreatingPoi] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState("");
  const [audioError, setAudioError] = useState("");
  const [selectedAudioLanguage, setSelectedAudioLanguage] = useState("auto");
  const [deletingPoiId, setDeletingPoiId] = useState(null);

  const role = String(profile?.role || "USER").toUpperCase();
  const isPartner = role === "PARTNER";
  const publishedCount = pois.filter((item) =>
    Boolean(item?.isPublished),
  ).length;
  const publishedPois = useMemo(
    () => pois.filter((item) => Boolean(item?.isPublished)),
    [pois],
  );

  const latestPartnerRegistrationRequest =
    partnerRegistrationRequests[0] || null;

  const markerPosition =
    clampCoordinate(latitudeInput, -90, 90) !== null &&
    clampCoordinate(longitudeInput, -180, 180) !== null
      ? [Number(latitudeInput), Number(longitudeInput)]
      : null;

  const isEditingPoi = Boolean(editingPoiId);

  const resetPoiForm = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    if (generatedAudioUrl) {
      URL.revokeObjectURL(generatedAudioUrl);
    }
    setPointName("");
    setPointDescription("");
    setPointCategory("FOOD");
    setLatitudeInput("10.762622");
    setLongitudeInput("106.660172");
    setRadiusInput("120");
    setImageFile(null);
    setImagePreviewUrl("");
    setGeneratedAudioUrl("");
    setAudioError("");
    setSelectedAudioLanguage("auto");
    setEditingPoiId(null);
  };

  const openCreatePoiModal = () => {
    resetPoiForm();
    setIsPoiModalOpen(true);
  };

  const openEditPoiModal = (item) => {
    resetPoiForm();
    setEditingPoiId(item.id);
    setPointName(item?.name?.vi || item?.name?.en || pickLocalized(item.name));
    setPointDescription(
      item?.description?.vi ||
        item?.description?.en ||
        pickLocalized(item.description),
    );
    setPointCategory(item?.type || "FOOD");
    setLatitudeInput(String(item?.latitude ?? ""));
    setLongitudeInput(String(item?.longitude ?? ""));
    setRadiusInput(String(item?.radius ?? 120));
    setIsPoiModalOpen(true);
  };

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      if (generatedAudioUrl) {
        URL.revokeObjectURL(generatedAudioUrl);
      }
    };
  }, [generatedAudioUrl, imagePreviewUrl]);

  const loadProfile = async () => {
    try {
      setIsLoadingProfile(true);
      setProfileError("");
      const response = await usersAPI.getProfile();
      const userData = response?.data || response;
      setProfile(userData);
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "Không tải được hồ sơ.",
      );
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const loadPartnerData = useCallback(async () => {
    try {
      setIsLoadingPartnerData(true);
      const myPois = await partnerAPI.getMyPois();
      setPois(Array.isArray(myPois) ? myPois : []);
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Không tải được dữ liệu đối tác.",
      );
    } finally {
      setIsLoadingPartnerData(false);
    }
  }, [showError]);

  const loadPartnerRegistrationData = useCallback(async () => {
    try {
      setIsLoadingRegistrationRequests(true);
      const items = await partnerAPI.listMyPartnerRegistrationRequests();
      setPartnerRegistrationRequests(Array.isArray(items) ? items : []);
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Không tải được trạng thái đăng ký đối tác.",
      );
    } finally {
      setIsLoadingRegistrationRequests(false);
    }
  }, [showError]);

  useEffect(() => {
    if (!token) return;
    loadProfile();
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    const buildPoiQrs = async () => {
      if (!pois.length) {
        setPoiQrMap({});
        return;
      }

      const entries = await Promise.all(
        pois.map(async (poi) => {
          const poiId = String(poi?.id || "").trim();

          if (!poiId) {
            return [poiId, ""];
          }

          try {
            const qrDataUrl = await QRCode.toDataURL(poiId, {
              width: 112,
              margin: 1,
            });
            return [poiId, qrDataUrl];
          } catch {
            return [poiId, ""];
          }
        }),
      );

      if (cancelled) {
        return;
      }

      const nextMap = {};
      for (const [poiId, qrDataUrl] of entries) {
        if (poiId && qrDataUrl) {
          nextMap[poiId] = qrDataUrl;
        }
      }
      setPoiQrMap(nextMap);
    };

    buildPoiQrs();

    return () => {
      cancelled = true;
    };
  }, [pois]);

  useEffect(() => {
    if (!isPartner) {
      setPois([]);
      loadPartnerRegistrationData();
      return;
    }

    setPartnerRegistrationRequests([]);
    loadPartnerData();
  }, [isPartner, loadPartnerData, loadPartnerRegistrationData]);

  const handleSubmitPartnerRegistration = async (e) => {
    e.preventDefault();

    const nextShopName = shopName.trim();
    const nextShopAddress = shopAddress.trim();

    if (!nextShopName) {
      showError("Vui lòng nhập tên cửa hàng/quán.");
      return;
    }

    if (!nextShopAddress) {
      showError("Vui lòng nhập địa chỉ cửa hàng/quán.");
      return;
    }

    try {
      setIsSubmittingRegistration(true);
      await partnerAPI.submitPartnerRegistrationRequest({
        shopName: nextShopName,
        shopAddress: nextShopAddress,
        note: registrationNote.trim() || undefined,
      });
      showSuccess("Đã gửi yêu cầu đăng ký đối tác. Vui lòng chờ ADMIN duyệt.");
      setShopName("");
      setShopAddress("");
      setRegistrationNote("");
      await loadPartnerRegistrationData();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Không thể gửi yêu cầu đăng ký đối tác.",
      );
    } finally {
      setIsSubmittingRegistration(false);
    }
  };

  const handleCreatePoiRequest = async (e) => {
    e.preventDefault();

    const trimmedName = pointName.trim();
    const trimmedDescription = pointDescription.trim();
    const latitude = clampCoordinate(latitudeInput, -90, 90);
    const longitude = clampCoordinate(longitudeInput, -180, 180);
    const radius = Number(radiusInput);

    if (!trimmedName || !trimmedDescription) {
      showError("Vui lòng nhập tên POI và mô tả.");
      return;
    }

    if (latitude === null || longitude === null) {
      showError("Tọa độ không hợp lệ.");
      return;
    }

    if (!Number.isFinite(radius) || radius <= 0) {
      showError("Bán kính phải là số dương.");
      return;
    }

    const payload = {
      name: { vi: trimmedName },
      description: { vi: trimmedDescription },
      type: pointCategory,
      latitude,
      longitude,
      radius,
    };

    try {
      setIsCreatingPoi(true);
      if (isEditingPoi && editingPoiId) {
        await partnerAPI.updatePoiRequest(editingPoiId, payload);

        if (imageFile) {
          try {
            await partnerAPI.uploadPoiImage(editingPoiId, imageFile);
            showSuccess("Đã cập nhật POI và upload ảnh thành công.");
          } catch (uploadError) {
            showError(
              uploadError instanceof Error
                ? `POI đã cập nhật nhưng upload ảnh thất bại: ${uploadError.message}`
                : "POI đã cập nhật nhưng upload ảnh thất bại.",
            );
          }
        } else {
          showSuccess("Đã cập nhật POI thành công.");
        }
      } else {
        const created = await partnerAPI.createPoiRequest(payload);
        const createdPoi = created?.data || created;
        const createdPoiId = createdPoi?.id;

        if (imageFile && createdPoiId) {
          try {
            await partnerAPI.uploadPoiImage(createdPoiId, imageFile);
            showSuccess("Đã tạo POI và upload ảnh thành công.");
          } catch (uploadError) {
            showError(
              uploadError instanceof Error
                ? `POI đã tạo nhưng upload ảnh thất bại: ${uploadError.message}`
                : "POI đã tạo nhưng upload ảnh thất bại.",
            );
          }
        } else {
          showSuccess("Đã tạo POI thành công.");
        }

        if (createdPoiId) {
          try {
            const qrDataUrl = await QRCode.toDataURL(String(createdPoiId), {
              width: 320,
              margin: 1,
            });

            const downloadLink = document.createElement("a");
            downloadLink.href = qrDataUrl;
            downloadLink.download = `poi-${createdPoiId}-qr.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            showSuccess("Đã tạo mã QR chứa ID của POI.");
          } catch (qrError) {
            showError(
              qrError instanceof Error
                ? `POI đã tạo nhưng tạo QR thất bại: ${qrError.message}`
                : "POI đã tạo nhưng tạo QR thất bại.",
            );
          }
        } else {
          showError("POI đã tạo nhưng chưa có ID để tạo mã QR.");
        }
      }

      setIsPoiModalOpen(false);
      resetPoiForm();
      await loadPartnerData();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Không thể gửi yêu cầu tạo POI.",
      );
    } finally {
      setIsCreatingPoi(false);
    }
  };

  const handleMapPick = (lat, lng) => {
    setLatitudeInput(lat.toFixed(6));
    setLongitudeInput(lng.toFixed(6));
  };

  const handlePickImage = (event) => {
    const nextFile = event.target.files?.[0] || null;

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    if (!nextFile) {
      setImageFile(null);
      setImagePreviewUrl("");
      return;
    }

    if (!nextFile.type.startsWith("image/")) {
      showError("Chỉ chấp nhận file ảnh hợp lệ.");
      setImageFile(null);
      setImagePreviewUrl("");
      event.target.value = "";
      return;
    }

    setImageFile(nextFile);
    setImagePreviewUrl(URL.createObjectURL(nextFile));
  };

  const handleGenerateAudioPreview = async () => {
    const text = pointDescription.trim();
    if (!text) {
      showError("Vui lòng nhập mô tả POI trước khi sinh audio preview.");
      return;
    }

    try {
      setIsGeneratingAudio(true);
      setAudioError("");

      const { audioUrl } = await ttsAPI.previewFromText(
        text,
        selectedAudioLanguage,
      );

      if (generatedAudioUrl) {
        URL.revokeObjectURL(generatedAudioUrl);
      }

      setGeneratedAudioUrl(audioUrl);
      showSuccess("Đã sinh audio preview từ mô tả.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Không thể sinh audio preview.";
      setAudioError(message);
      showError(message);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleDeletePoi = async (item) => {
    if (!item?.id) return;

    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa POI "${pickLocalized(item.name)}"?`,
    );
    if (!confirmed) return;

    try {
      setDeletingPoiId(item.id);
      await partnerAPI.deletePoiRequest(item.id, "Xóa POI từ trang đối tác");
      showSuccess("Đã xóa POI thành công.");
      await loadPartnerData();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể xóa POI.");
    } finally {
      setDeletingPoiId(null);
    }
  };

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="w-full min-h-full bg-slate-50 p-4 md:p-6">
      <div className="h-full w-full rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm md:p-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-emerald-600">
          PARTNER
        </p>
        <h1 className="mb-6 text-3xl font-black text-slate-900">Đối tác</h1>

        <div className="mb-4">
          <Link
            to="/profile"
            className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Quay lại hồ sơ
          </Link>
        </div>

        {isLoadingProfile && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Đang tải hồ sơ...
          </div>
        )}

        {!isLoadingProfile && profileError && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {profileError}
          </div>
        )}

        {!isLoadingProfile && !profileError && profile && !isPartner && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="text-sm font-semibold">Bạn chưa là đối tác</p>
            <p className="mt-1 text-xs">
              Gửi yêu cầu đăng ký để ADMIN xét duyệt nâng role PARTNER.
            </p>

            <form
              onSubmit={handleSubmitPartnerRegistration}
              className="mt-3 grid grid-cols-1 gap-3"
            >
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Tên cửa hàng/quán
                </span>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="Nhập tên cửa hàng/quán"
                  className="h-11 w-full rounded-xl border border-amber-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Địa chỉ cửa hàng/quán
                </span>
                <input
                  type="text"
                  value={shopAddress}
                  onChange={(e) => setShopAddress(e.target.value)}
                  placeholder="Nhập địa chỉ cửa hàng/quán"
                  className="h-11 w-full rounded-xl border border-amber-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Ghi chú thêm (không bắt buộc)
                </span>
                <textarea
                  value={registrationNote}
                  onChange={(e) => setRegistrationNote(e.target.value)}
                  placeholder="Nhập ghi chú nếu có"
                  rows={3}
                  className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-500"
                />
              </label>
              <button
                type="submit"
                disabled={isSubmittingRegistration}
                className="h-11 rounded-xl bg-amber-500 px-5 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60 md:w-fit"
              >
                {isSubmittingRegistration
                  ? "Đang gửi..."
                  : "Gửi yêu cầu đăng ký đối tác"}
              </button>
            </form>

            <div className="mt-4 rounded-xl border border-amber-200 bg-white/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                Trạng thái gần nhất
              </p>
              {isLoadingRegistrationRequests ? (
                <p className="mt-2 text-sm text-amber-800">Đang tải...</p>
              ) : !latestPartnerRegistrationRequest ? (
                <p className="mt-2 text-sm text-amber-800">
                  Bạn chưa gửi yêu cầu nào.
                </p>
              ) : (
                <div className="mt-2 space-y-1 text-sm text-amber-900">
                  <span
                    className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${getApprovalStatusBadge(
                      latestPartnerRegistrationRequest.status,
                    )}`}
                  >
                    {latestPartnerRegistrationRequest.status}
                  </span>
                  <p>Tên quán: {latestPartnerRegistrationRequest.shopName}</p>
                  <p>Địa chỉ: {latestPartnerRegistrationRequest.shopAddress}</p>
                  <p>
                    Ngày gửi:{" "}
                    {formatDate(latestPartnerRegistrationRequest.createdAt)}
                  </p>
                  {latestPartnerRegistrationRequest.decisionNote && (
                    <p>
                      Ghi chú duyệt:{" "}
                      {latestPartnerRegistrationRequest.decisionNote}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {!isLoadingProfile && !profileError && isPartner && (
          <>
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <p className="text-sm font-semibold">
                Tài khoản PARTNER đã kích hoạt
              </p>
              <p className="mt-1 text-xs">Bạn có thể tạo POI trực tiếp.</p>
            </div>

            <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Tổng POI
                </p>
                <p className="mt-2 text-3xl font-black text-slate-900">
                  {pois.length}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  POI đã publish
                </p>
                <p className="mt-2 text-3xl font-black text-slate-900">
                  {publishedCount}
                </p>
              </div>
            </section>

            <div className="mb-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={openCreatePoiModal}
                className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Tạo POI mới
              </button>
              <button
                type="button"
                onClick={loadPartnerData}
                disabled={isLoadingPartnerData}
                className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                {isLoadingPartnerData ? "Đang tải..." : "Làm mới"}
              </button>
            </div>

            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Danh sách POI hiện tại
              </p>
              {publishedPois.length === 0 ? (
                <p className="text-sm text-slate-600">
                  Chưa có POI nào đã publish thuộc tài khoản của bạn.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 pr-4 font-semibold">Tên POI</th>
                        <th className="py-2 pr-4 font-semibold">Loại</th>
                        <th className="py-2 pr-4 font-semibold">Tọa độ</th>
                        <th className="py-2 pr-4 font-semibold">Xuất bản</th>
                        <th className="py-2 pr-4 font-semibold">
                          Thời gian tạo
                        </th>
                        <th className="py-2 pr-4 font-semibold">QR POI</th>
                        <th className="py-2 pr-0 font-semibold">Cập nhật</th>
                        <th className="py-2 pr-0 font-semibold text-right">
                          Thao tác
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {publishedPois.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-slate-100 text-slate-700 last:border-b-0"
                        >
                          <td className="py-2 pr-4 font-medium">
                            {pickLocalized(item.name)}
                          </td>
                          <td className="py-2 pr-4">{item.type}</td>
                          <td className="py-2 pr-4 text-xs">
                            {Number(item.latitude).toFixed(6)},{" "}
                            {Number(item.longitude).toFixed(6)}
                          </td>
                          <td className="py-2 pr-4">
                            {item.isPublished ? "Có" : "Chưa"}
                          </td>
                          <td className="py-2 pr-4 text-xs">
                            {formatDate(item.createdAt)}
                          </td>
                          <td className="py-2 pr-4">
                            {poiQrMap[item.id] ? (
                              <a
                                href={poiQrMap[item.id]}
                                download={`poi-${item.id}-qr.png`}
                                title="Tải QR"
                                className="inline-flex rounded-lg border border-slate-200 p-1 transition hover:border-emerald-300 hover:bg-emerald-50"
                              >
                                <img
                                  src={poiQrMap[item.id]}
                                  alt={`QR POI ${pickLocalized(item.name)}`}
                                  className="h-14 w-14 rounded object-cover"
                                />
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">
                                Chưa có mã QR
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-0 text-xs">
                            {formatDate(item.updatedAt)}
                          </td>
                          <td className="py-2 pl-3 pr-0 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditPoiModal(item)}
                                className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePoi(item)}
                                disabled={deletingPoiId === item.id}
                                className="h-8 rounded-lg border border-rose-300 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                              >
                                {deletingPoiId === item.id
                                  ? "Đang xóa..."
                                  : "Xóa"}
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
          </>
        )}
      </div>

      {isPartner && isPoiModalOpen && (
        <div
          className="fixed inset-0 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-2 pb-3 pt-16 md:px-4 md:pb-4 md:pt-24"
          style={{ zIndex: 2147483647 }}
        >
          <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-3 shadow-2xl md:p-4">
            <form onSubmit={handleCreatePoiRequest}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  {isEditingPoi ? "Cập nhật POI" : "Tạo POI trực tiếp"}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsPoiModalOpen(false);
                    resetPoiForm();
                  }}
                  className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Đóng
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Tên POI
                  </span>
                  <input
                    type="text"
                    value={pointName}
                    onChange={(e) => setPointName(e.target.value)}
                    placeholder="Nhập tên POI"
                    className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Loại POI
                  </span>
                  <select
                    value={pointCategory}
                    onChange={(e) => setPointCategory(e.target.value)}
                    className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500"
                  >
                    <option value="FOOD">Food</option>
                    <option value="DRINK">Drink</option>
                    <option value="SNACK">Snack</option>
                    <option value="WC">WC</option>
                  </select>
                </label>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Ảnh POI
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePickImage}
                  className="h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-emerald-100 file:px-3 file:py-1 file:text-emerald-800"
                />

                {imagePreviewUrl && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <img
                      src={imagePreviewUrl}
                      alt="POI preview"
                      className="h-44 w-full rounded-lg object-cover md:w-80"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(imagePreviewUrl);
                        setImageFile(null);
                        setImagePreviewUrl("");
                      }}
                      className="mt-3 h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Xóa ảnh đã chọn
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-3">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Mô tả POI
                  </span>
                  <textarea
                    value={pointDescription}
                    onChange={(e) => setPointDescription(e.target.value)}
                    placeholder="Nhập mô tả POI"
                    rows={4}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500"
                  />
                </label>
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 grid gap-1 md:max-w-sm">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Ngôn ngữ audio
                  </label>
                  <select
                    value={selectedAudioLanguage}
                    onChange={(e) => setSelectedAudioLanguage(e.target.value)}
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-indigo-500"
                  >
                    <option value="auto">Auto (backend tự nhận diện)</option>
                    <option value="vi">Vietnamese (vi)</option>
                    <option value="en">English (en)</option>
                    <option value="ja">Japanese (ja)</option>
                    <option value="ko">Korean (ko)</option>
                    <option value="zh">Chinese (zh)</option>
                    <option value="fr">French (fr)</option>
                    <option value="de">German (de)</option>
                    <option value="es">Spanish (es)</option>
                    <option value="pt">Portuguese (pt)</option>
                    <option value="id">Indonesian (id)</option>
                    <option value="tr">Turkish (tr)</option>
                    <option value="ru">Russian (ru)</option>
                    <option value="ar">Arabic (ar)</option>
                    <option value="hi">Hindi (hi)</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateAudioPreview}
                    disabled={isGeneratingAudio}
                    className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {isGeneratingAudio
                      ? "Đang sinh audio..."
                      : "Sinh audio preview từ mô tả"}
                  </button>

                  {generatedAudioUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(generatedAudioUrl);
                        setGeneratedAudioUrl("");
                        setAudioError("");
                      }}
                      className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Xóa preview
                    </button>
                  )}
                </div>

                <p className="mt-2 text-xs text-slate-600">
                  TTS provider: Google Cloud • Ngôn ngữ gửi:{" "}
                  {selectedAudioLanguage.toUpperCase()}
                </p>

                {audioError && (
                  <p className="mt-2 text-xs font-semibold text-rose-600">
                    Lỗi audio preview: {audioError}
                  </p>
                )}

                {generatedAudioUrl && (
                  <div className="mt-3">
                    <audio controls className="w-full">
                      <source src={generatedAudioUrl} type="audio/wav" />
                    </audio>
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Latitude
                  </span>
                  <input
                    type="number"
                    step="0.000001"
                    value={latitudeInput}
                    onChange={(e) => setLatitudeInput(e.target.value)}
                    placeholder="Ví dụ: 10.762622"
                    className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Longitude
                  </span>
                  <input
                    type="number"
                    step="0.000001"
                    value={longitudeInput}
                    onChange={(e) => setLongitudeInput(e.target.value)}
                    placeholder="Ví dụ: 106.660172"
                    className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Bán kính (m)
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={radiusInput}
                    onChange={(e) => setRadiusInput(e.target.value)}
                    placeholder="Nhập bán kính"
                    className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500"
                  />
                </label>
              </div>

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
                  {markerPosition && (
                    <Circle
                      center={markerPosition}
                      radius={Number(radiusInput) || 120}
                      pathOptions={{
                        color: "#f97316",
                        fillColor: "#fb923c",
                        fillOpacity: 0.2,
                        weight: 2,
                      }}
                    />
                  )}
                  <CoordinatePicker
                    markerPosition={markerPosition}
                    onPick={handleMapPick}
                  />
                </MapContainer>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  {isEditingPoi
                    ? "POI sẽ được cập nhật ngay sau khi gửi."
                    : "POI sẽ được tạo ngay sau khi gửi."}
                </p>
                <button
                  type="submit"
                  disabled={isCreatingPoi}
                  className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {isCreatingPoi
                    ? isEditingPoi
                      ? "Đang cập nhật..."
                      : "Đang tạo..."
                    : isEditingPoi
                      ? "Cập nhật POI"
                      : "Tạo POI"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
