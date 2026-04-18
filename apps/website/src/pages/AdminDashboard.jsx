import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock3,
  CircleDollarSign,
  FileText,
  Gauge,
  ImagePlus,
  LayoutDashboard,
  Layers3,
  MapPinned,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { getRoleFromToken } from "../lib/jwt";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3000";

const statCards = [
  {
    key: "totalPois",
    title: "Tổng số POI",
    icon: MapPinned,
    gradient: "from-orange-500 to-rose-500",
  },
  {
    key: "publishedPois",
    title: "POI đã xuất bản",
    icon: ShieldCheck,
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    key: "paymentPackages",
    title: "Gói giá đang bật",
    icon: CircleDollarSign,
    gradient: "from-cyan-500 to-sky-500",
  },
];

function getPartnerRegistrationTone(status) {
  if (status === "APPROVED") {
    return "emerald";
  }

  if (status === "REJECTED") {
    return "rose";
  }

  return "amber";
}

function getPartnerRegistrationLabel(status) {
  if (status === "APPROVED") {
    return "Đã duyệt";
  }

  if (status === "REJECTED") {
    return "Đã từ chối";
  }

  return "Chờ xử lý";
}

function DashboardMetric({ title, value, delta, icon, gradient }) {
  const MetricIcon = icon;

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.24)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white/60">{title}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-white">
            {value}
          </p>
          <p className="mt-2 text-sm text-white/55">{delta}</p>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br ${gradient} text-white shadow-lg shadow-black/20`}
        >
          <MetricIcon size={22} />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ tone, children }) {
  const toneMap = {
    amber: "border-amber-400/30 bg-amber-400/12 text-amber-100",
    emerald: "border-emerald-400/30 bg-emerald-400/12 text-emerald-100",
    rose: "border-rose-400/30 bg-rose-400/12 text-rose-100",
    slate: "border-white/15 bg-white/8 text-white/70",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${toneMap[tone] ?? toneMap.slate}`}
    >
      {children}
    </span>
  );
}

function buildApiUrl(path) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL.replace(/\/+$/, "")}${cleanPath}`;
}

async function fetchJson(path, options = {}) {
  const { method = "GET", headers = {}, body } = options;
  const response = await fetch(buildApiUrl(path), {
    method,
    headers: {
      Accept: "application/json",
      ...headers,
    },
    body,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      message = payload?.message || payload?.error || message;
    } catch {
      const text = await response.text();
      if (text) {
        message = text;
      }
    }

    throw new Error(message);
  }

  return response.json();
}

function getStoredToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return (
    window.localStorage.getItem("accessToken")?.trim() ||
    window.localStorage.getItem("token")?.trim() ||
    ""
  );
}

function pickLocalizedText(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    const record = value;
    const preferred = record.vi || record.en;
    if (typeof preferred === "string" && preferred.trim()) {
      return preferred.trim();
    }

    const firstText = Object.values(record).find(
      (item) => typeof item === "string" && item.trim(),
    );
    if (typeof firstText === "string") {
      return firstText.trim();
    }
  }

  return String(value);
}

function hasAudioUrls(audioUrls) {
  if (!audioUrls || typeof audioUrls !== "object") {
    return false;
  }

  return Object.values(audioUrls).some(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
}

function formatRelativeTime(value) {
  if (!value) {
    return "Không rõ";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Không rõ";
  }

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) {
    return "vừa xong";
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrency(value, currency = "VND") {
  try {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${formatNumber(value)} ${currency}`;
  }
}

function getPoiStatusTone(poi) {
  if (!poi.isPublished) {
    return "slate";
  }

  if (!hasAudioUrls(poi.audioUrls)) {
    return "rose";
  }

  return "emerald";
}

function getPoiStatusLabel(poi) {
  if (!poi.isPublished) {
    return "Bản nháp";
  }

  if (!hasAudioUrls(poi.audioUrls)) {
    return "Cần tạo audio";
  }

  return "Đã xuất bản";
}

function revokeBlobUrl(url) {
  if (typeof url === "string" && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export default function AdminDashboard() {
  const sidebarMenus = [
    { key: "overview", label: "Tổng quan", icon: LayoutDashboard },
    { key: "pois", label: "POI", icon: FileText },
    { key: "partners", label: "Đối tác", icon: Layers3 },
    { key: "pricing", label: "Gói giá", icon: CircleDollarSign },
    { key: "users", label: "Người dùng", icon: ShieldCheck },
    { key: "analytics", label: "Thống kê", icon: BarChart3 },
    { key: "settings", label: "Cài đặt", icon: Settings2 },
  ];

  const [adminPois, setAdminPois] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [paymentPackages, setPaymentPackages] = useState([]);
  const [partnerRegistrationRequests, setPartnerRegistrationRequests] =
    useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingUserRoleId, setIsUpdatingUserRoleId] = useState("");
  const [isUpdatingUserAccessId, setIsUpdatingUserAccessId] = useState("");
  const [isSavingPackage, setIsSavingPackage] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [packageError, setPackageError] = useState("");
  const [packageSuccess, setPackageSuccess] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [userSearchText, setUserSearchText] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);
  const [poiTypeFilter, setPoiTypeFilter] = useState("ALL");
  const [pendingUserAction, setPendingUserAction] = useState(null);
  const [activePoiActionId, setActivePoiActionId] = useState("");
  const [isPoiEditModalOpen, setIsPoiEditModalOpen] = useState(false);
  const [isSavingPoiEdit, setIsSavingPoiEdit] = useState(false);
  const [poiEditError, setPoiEditError] = useState("");
  const [poiEditImageFile, setPoiEditImageFile] = useState(null);
  const [poiEditImagePreviewUrl, setPoiEditImagePreviewUrl] = useState("");
  const [poiEditForm, setPoiEditForm] = useState({
    id: "",
    name: "",
    description: "",
    type: "FOOD",
    latitude: "",
    longitude: "",
    radius: "120",
  });
  const [activeSection, setActiveSection] = useState("overview");
  const [editingPackageCode, setEditingPackageCode] = useState("");
  const [packageForm, setPackageForm] = useState({
    name: "",
    amount: "",
    currency: "VND",
    durationDays: "30",
    poiQuota: "1",
    description: "",
    isActive: true,
  });

  const storedToken = getStoredToken();
  const userRole = storedToken ? getRoleFromToken(storedToken) : "USER";

  useEffect(() => {
    return () => {
      revokeBlobUrl(poiEditImagePreviewUrl);
    };
  }, [poiEditImagePreviewUrl]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setIsLoading(true);
      setLoadError("");

      if (!storedToken) {
        if (!cancelled) {
          setLoadError(
            "Bạn chưa đăng nhập. Hãy đăng nhập tài khoản ADMIN để tải dữ liệu dashboard.",
          );
          setIsLoading(false);
        }
        return;
      }

      const adminHeaders = { Authorization: `Bearer ${storedToken}` };
      const adminRequests = await Promise.allSettled([
        fetchJson("/api/v1/admin/pois", { headers: adminHeaders }),
        fetchJson("/api/v1/admin/users", { headers: adminHeaders }),
        fetchJson("/api/v1/admin/partner-registration-requests", {
          headers: adminHeaders,
        }),
        fetchJson("/api/v1/admin/payment-packages?includeInactive=true", {
          headers: adminHeaders,
        }),
      ]);

      const errors = [];

      if (adminRequests[0].status === "fulfilled") {
        setAdminPois(adminRequests[0].value.items ?? []);
      } else {
        setAdminPois([]);
        errors.push(`POIs: ${adminRequests[0].reason.message}`);
      }

      if (adminRequests[1].status === "fulfilled") {
        setAdminUsers(adminRequests[1].value.items ?? []);
      } else {
        setAdminUsers([]);
        errors.push(`Users: ${adminRequests[1].reason.message}`);
      }

      if (adminRequests[2].status === "fulfilled") {
        setPartnerRegistrationRequests(adminRequests[2].value.items ?? []);
      } else {
        setPartnerRegistrationRequests([]);
        errors.push(
          `Partner registrations: ${adminRequests[2].reason.message}`,
        );
      }

      if (adminRequests[3].status === "fulfilled") {
        setPaymentPackages(adminRequests[3].value.items ?? []);
      } else {
        setPaymentPackages([]);
        errors.push(`Payment packages: ${adminRequests[3].reason.message}`);
      }

      if (!cancelled) {
        setLoadError(errors.length > 0 ? errors.join(" • ") : "");
        setIsLoading(false);
      }
    }

    loadDashboard().catch((error) => {
      if (!cancelled) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Không tải được dữ liệu admin.",
        );
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [reloadTick, storedToken]);

  useEffect(() => {
    if (!packageError && !packageSuccess) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPackageError("");
      setPackageSuccess("");
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [packageError, packageSuccess]);

  const handleReviewPartnerRegistrationRequest = async (requestId, action) => {
    const decisionWord = action === "approve" ? "duyệt" : "từ chối";
    const decisionNote = window.prompt(
      `Nhập ghi chú khi ${decisionWord} yêu cầu này (có thể để trống):`,
      "",
    );

    try {
      await fetchJson(
        `/api/v1/admin/partner-registration-requests/${requestId}/${action}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
          body: JSON.stringify({
            decisionNote: decisionNote?.trim() || undefined,
          }),
        },
      );
      setReloadTick((tick) => tick + 1);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Không thể xử lý yêu cầu đăng ký đối tác.",
      );
    }
  };

  const executeUpdateUserRole = async (targetUserId, targetRole) => {
    try {
      setIsUpdatingUserRoleId(targetUserId);

      if (targetRole === "USER") {
        await fetchJson(`/api/v1/admin/users/${targetUserId}/role/revoke`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });
      } else {
        await fetchJson(`/api/v1/admin/users/${targetUserId}/role`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${storedToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: targetRole,
          }),
        });
      }

      setReloadTick((tick) => tick + 1);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật quyền người dùng.",
      );
    } finally {
      setIsUpdatingUserRoleId("");
    }
  };

  const executeUpdateUserAccess = async (targetUserId, shouldLock) => {
    try {
      setIsUpdatingUserAccessId(targetUserId);

      await fetchJson(
        `/api/v1/admin/users/${targetUserId}/${shouldLock ? "lock" : "unlock"}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        },
      );

      setReloadTick((tick) => tick + 1);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật trạng thái khóa tài khoản.",
      );
    } finally {
      setIsUpdatingUserAccessId("");
    }
  };

  const requestUpdateUserRole = (targetUserId, targetRole) => {
    setPendingUserAction({
      type: "role",
      targetUserId,
      targetRole,
    });
  };

  const requestUpdateUserAccess = (targetUserId, shouldLock) => {
    setPendingUserAction({
      type: "access",
      targetUserId,
      shouldLock,
    });
  };

  const handleConfirmUserAction = async () => {
    if (!pendingUserAction) {
      return;
    }

    if (pendingUserAction.type === "role") {
      await executeUpdateUserRole(
        pendingUserAction.targetUserId,
        pendingUserAction.targetRole,
      );
      setPendingUserAction(null);
      return;
    }

    await executeUpdateUserAccess(
      pendingUserAction.targetUserId,
      pendingUserAction.shouldLock,
    );
    setPendingUserAction(null);
  };

  const handlePackageFormChange = (field, value) => {
    setPackageForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const resetPackageForm = () => {
    setEditingPackageCode("");
    setPackageForm({
      name: "",
      amount: "",
      currency: "VND",
      durationDays: "30",
      poiQuota: "1",
      description: "",
      isActive: true,
    });
  };

  const handleEditPaymentPackage = (item) => {
    setEditingPackageCode(item.code);
    setPackageForm({
      name: item.name || "",
      amount: String(item.amount ?? ""),
      currency: item.currency || "VND",
      durationDays: String(item.durationDays ?? 30),
      poiQuota: String(item.poiQuota ?? 1),
      description: item.description || "",
      isActive: Boolean(item.isActive),
    });
    setActiveSection("pricing");
    setPackageError("");
    setPackageSuccess("");
  };

  const handleTogglePaymentPackage = async (item) => {
    try {
      setIsSavingPackage(true);
      setPackageError("");
      setPackageSuccess("");
      await fetchJson(`/api/v1/admin/payment-packages/${item.code}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${storedToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      setPackageSuccess(
        item.isActive ? "Đã tắt gói giá." : "Đã bật lại gói giá.",
      );
      setReloadTick((tick) => tick + 1);
    } catch (error) {
      setPackageError(
        error instanceof Error ? error.message : "Không thể cập nhật gói giá.",
      );
    } finally {
      setIsSavingPackage(false);
    }
  };

  const handleDeletePaymentPackage = async (item) => {
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa gói "${item.name}" (${item.code})?`,
    );
    if (!confirmed) return;

    try {
      setIsSavingPackage(true);
      setPackageError("");
      setPackageSuccess("");
      await fetchJson(`/api/v1/admin/payment-packages/${item.code}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${storedToken}`,
        },
      });
      if (editingPackageCode === item.code) {
        resetPackageForm();
      }
      setPackageSuccess("Đã xóa gói giá.");
      setReloadTick((tick) => tick + 1);
    } catch (error) {
      setPackageError(
        error instanceof Error ? error.message : "Không thể xóa gói giá.",
      );
    } finally {
      setIsSavingPackage(false);
    }
  };

  const handleCreatePaymentPackage = async (event) => {
    event.preventDefault();

    try {
      setIsSavingPackage(true);
      setPackageError("");
      setPackageSuccess("");

      const payload = {
        name: packageForm.name.trim(),
        amount: Number(packageForm.amount),
        currency: packageForm.currency.trim() || "VND",
        durationDays: Number(packageForm.durationDays),
        poiQuota: Number(packageForm.poiQuota),
        description: packageForm.description.trim() || undefined,
        isActive: Boolean(packageForm.isActive),
      };

      const path = editingPackageCode
        ? `/api/v1/admin/payment-packages/${editingPackageCode}`
        : "/api/v1/admin/payment-packages";

      await fetchJson(path, {
        method: editingPackageCode ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${storedToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      resetPackageForm();
      setPackageSuccess(
        editingPackageCode
          ? "Đã cập nhật gói giá thành công."
          : "Đã tạo gói giá thành công.",
      );
      setReloadTick((tick) => tick + 1);
    } catch (error) {
      setPackageError(
        error instanceof Error ? error.message : "Không thể lưu gói giá.",
      );
    } finally {
      setIsSavingPackage(false);
    }
  };

  const handleEditPoi = (poiId) => {
    const poi = adminPois.find((item) => item.id === poiId);
    if (!poi) {
      setLoadError("Không tìm thấy POI để chỉnh sửa.");
      return;
    }
    setPoiEditError("");
    setPoiEditImageFile(null);
    revokeBlobUrl(poiEditImagePreviewUrl);
    setPoiEditImagePreviewUrl(
      typeof poi.image === "string" ? poi.image.trim() : "",
    );
    setPoiEditForm({
      id: poi.id,
      name: pickLocalizedText(poi.name) || "",
      description: pickLocalizedText(poi.description) || "",
      type: String(poi.type || "FOOD").toUpperCase(),
      latitude:
        poi.latitude !== undefined && poi.latitude !== null
          ? String(poi.latitude)
          : "",
      longitude:
        poi.longitude !== undefined && poi.longitude !== null
          ? String(poi.longitude)
          : "",
      radius:
        poi.radius !== undefined && poi.radius !== null
          ? String(poi.radius)
          : "120",
    });
    setIsPoiEditModalOpen(true);
  };

  const closePoiEditModal = () => {
    revokeBlobUrl(poiEditImagePreviewUrl);
    setIsPoiEditModalOpen(false);
    setPoiEditError("");
    setPoiEditImageFile(null);
    setPoiEditImagePreviewUrl("");
    setPoiEditForm({
      id: "",
      name: "",
      description: "",
      type: "FOOD",
      latitude: "",
      longitude: "",
      radius: "120",
    });
  };

  const handlePoiEditFieldChange = (field, value) => {
    setPoiEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handlePickPoiEditImage = (event) => {
    const nextFile = event.target.files?.[0] || null;

    if (!nextFile) {
      revokeBlobUrl(poiEditImagePreviewUrl);
      setPoiEditImageFile(null);
      setPoiEditImagePreviewUrl("");
      return;
    }

    if (!nextFile.type.startsWith("image/")) {
      setPoiEditError("Chỉ chấp nhận file ảnh hợp lệ.");
      event.target.value = "";
      return;
    }

    revokeBlobUrl(poiEditImagePreviewUrl);
    setPoiEditError("");
    setPoiEditImageFile(nextFile);
    setPoiEditImagePreviewUrl(URL.createObjectURL(nextFile));
  };

  const handleTogglePoiPublish = async (poiId, shouldPublish) => {
    const poi = adminPois.find((item) => item.id === poiId);
    if (!poi) {
      setLoadError("Không tìm thấy POI để cập nhật trạng thái publish.");
      return;
    }

    try {
      setActivePoiActionId(poiId);
      await fetchJson(
        `/api/v1/admin/pois/${poiId}/${shouldPublish ? "publish" : "unpublish"}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${storedToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: shouldPublish
              ? "Admin publish POI từ dashboard"
              : "Admin unpublish POI từ dashboard",
          }),
        },
      );
      setReloadTick((tick) => tick + 1);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật trạng thái publish của POI.",
      );
    } finally {
      setActivePoiActionId("");
    }
  };

  const handleSubmitPoiEdit = async (event) => {
    event.preventDefault();

    const poiId = poiEditForm.id;
    const name = poiEditForm.name.trim();
    const description = poiEditForm.description.trim();
    const type = String(poiEditForm.type || "")
      .trim()
      .toUpperCase();
    const latitude = Number(poiEditForm.latitude);
    const longitude = Number(poiEditForm.longitude);
    const radius = Number(poiEditForm.radius);

    if (!poiId) {
      setPoiEditError("Thiếu POI id cần cập nhật.");
      return;
    }

    if (!name || !description) {
      setPoiEditError("Vui lòng nhập tên và mô tả POI.");
      return;
    }

    if (!["FOOD", "DRINK", "SNACK", "WC"].includes(type)) {
      setPoiEditError("Loại POI không hợp lệ.");
      return;
    }

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      setPoiEditError("Latitude không hợp lệ (phạm vi -90 đến 90).");
      return;
    }

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setPoiEditError("Longitude không hợp lệ (phạm vi -180 đến 180).");
      return;
    }

    if (!Number.isFinite(radius) || radius <= 0) {
      setPoiEditError("Bán kính phải là số dương.");
      return;
    }

    try {
      setIsSavingPoiEdit(true);
      setActivePoiActionId(poiId);
      setPoiEditError("");

      await fetchJson(`/api/v1/admin/pois/${poiId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${storedToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: { vi: name },
          description: { vi: description },
          type,
          latitude,
          longitude,
          radius,
          reason: "Admin cập nhật POI từ dashboard",
        }),
      });

      if (poiEditImageFile) {
        const formData = new FormData();
        formData.append("image", poiEditImageFile);

        const uploadResponse = await fetch(
          buildApiUrl(`/api/v1/admin/pois/${poiId}/image/upload`),
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
            body: formData,
          },
        );

        if (!uploadResponse.ok) {
          let uploadMessage = `Upload ảnh thất bại (${uploadResponse.status}).`;
          try {
            const uploadPayload = await uploadResponse.json();
            uploadMessage =
              uploadPayload?.message || uploadPayload?.error || uploadMessage;
          } catch {
            const uploadText = await uploadResponse.text();
            if (uploadText) {
              uploadMessage = uploadText;
            }
          }
          throw new Error(uploadMessage);
        }
      }

      closePoiEditModal();
      setReloadTick((tick) => tick + 1);
    } catch (error) {
      setPoiEditError(
        error instanceof Error ? error.message : "Không thể cập nhật POI.",
      );
    } finally {
      setIsSavingPoiEdit(false);
      setActivePoiActionId("");
    }
  };

  const handleDeletePoi = async (poiId) => {
    const poi = adminPois.find((item) => item.id === poiId);
    if (!poi) {
      setLoadError("Không tìm thấy POI để xóa.");
      return;
    }

    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa POI "${pickLocalizedText(poi.name) || poiId}"?`,
    );
    if (!confirmed) return;

    try {
      setActivePoiActionId(poiId);
      await fetchJson(`/api/v1/admin/pois/${poiId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${storedToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: "Admin xóa POI từ dashboard",
        }),
      });
      setReloadTick((tick) => tick + 1);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Không thể xóa POI.",
      );
    } finally {
      setActivePoiActionId("");
    }
  };

  const totalPois = adminPois.length;
  const publishedPois = adminPois.filter((poi) => poi.isPublished).length;

  const dashboardStats = statCards.map((card) => {
    if (card.key === "totalPois") {
      return {
        ...card,
        value: formatNumber(totalPois),
        delta: `${formatNumber(publishedPois)} POI đã xuất bản`,
      };
    }

    if (card.key === "publishedPois") {
      return {
        ...card,
        value: formatNumber(publishedPois),
        delta: totalPois
          ? `${Math.round((publishedPois / totalPois) * 100)}% nội dung đã xuất bản`
          : "Chưa có POI",
      };
    }

    if (card.key === "paymentPackages") {
      const activePackages = paymentPackages.filter((item) => item.isActive);
      return {
        ...card,
        value: formatNumber(activePackages.length),
        delta: paymentPackages.length
          ? `${formatNumber(paymentPackages.length)} gói đã cấu hình`
          : "Chưa có gói giá",
      };
    }

    return card;
  });

  const allPoiRows = useMemo(
    () =>
      adminPois.map((poi) => ({
        id: poi.id,
        type: poi.type || "POI",
        name: pickLocalizedText(poi.name) || "POI chưa đặt tên",
        isPublished: Boolean(poi.isPublished),
        version: `v${poi.contentVersion ?? 1}`,
        status: getPoiStatusLabel(poi),
        updated: formatRelativeTime(poi.updatedAt),
        tone: getPoiStatusTone(poi),
        creatorId: poi.creatorId || "",
      })),
    [adminPois],
  );

  const poiTypeOptions = useMemo(
    () =>
      Array.from(new Set(allPoiRows.map((poi) => poi.type)))
        .filter(Boolean)
        .sort(),
    [allPoiRows],
  );

  const filteredPoiRows = useMemo(
    () =>
      poiTypeFilter === "ALL"
        ? allPoiRows
        : allPoiRows.filter((poi) => poi.type === poiTypeFilter),
    [allPoiRows, poiTypeFilter],
  );

  const queueRows = filteredPoiRows.slice(0, 6);

  const latestUpdatedLabel = adminPois[0]?.updatedAt
    ? formatRelativeTime(adminPois[0].updatedAt)
    : "Chưa có POI";

  const normalizedAdminUsers = useMemo(
    () =>
      adminUsers.map((item) => ({
        id: item.id,
        email: String(item.email || ""),
        fullName: String(item.fullName || ""),
        role: String(item.role || "USER").toUpperCase(),
        isActive: Boolean(item.isActive),
        createdAt: item.createdAt,
      })),
    [adminUsers],
  );

  const confirmDialogContent = useMemo(() => {
    if (!pendingUserAction) {
      return null;
    }

    const selectedUser = normalizedAdminUsers.find(
      (user) => user.id === pendingUserAction.targetUserId,
    );
    const label =
      selectedUser?.fullName || selectedUser?.email || "tài khoản này";

    if (pendingUserAction.type === "role") {
      return {
        title: "Xác nhận cập nhật vai trò",
        message: `Bạn có chắc muốn đổi vai trò của ${label} sang ${pendingUserAction.targetRole}?`,
        confirmText: "Xác nhận đổi vai trò",
      };
    }

    if (pendingUserAction.shouldLock) {
      return {
        title: "Xác nhận khóa tài khoản",
        message: `Bạn có chắc muốn khóa ${label}? Tài khoản này sẽ không thể đăng nhập cho đến khi được mở khóa.`,
        confirmText: "Xác nhận khóa",
      };
    }

    return {
      title: "Xác nhận mở khóa tài khoản",
      message: `Bạn có chắc muốn mở khóa ${label}?`,
      confirmText: "Xác nhận mở khóa",
    };
  }, [normalizedAdminUsers, pendingUserAction]);

  const isConfirmingAction = Boolean(
    isUpdatingUserRoleId || isUpdatingUserAccessId,
  );

  const filteredAdminUsers = useMemo(() => {
    const keyword = userSearchText.trim().toLowerCase();

    return normalizedAdminUsers.filter((user) => {
      const roleOk = userRoleFilter === "ALL" || user.role === userRoleFilter;
      if (!roleOk) return false;

      if (!keyword) return true;

      const haystack =
        `${user.fullName} ${user.email} ${user.role}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [normalizedAdminUsers, userRoleFilter, userSearchText]);

  const totalUserPages = Math.max(
    1,
    Math.ceil(filteredAdminUsers.length / userPageSize),
  );

  const pagedAdminUsers = useMemo(() => {
    const safePage = Math.min(userPage, totalUserPages);
    const start = (safePage - 1) * userPageSize;
    return filteredAdminUsers.slice(start, start + userPageSize);
  }, [filteredAdminUsers, userPage, userPageSize, totalUserPages]);

  useEffect(() => {
    setUserPage(1);
  }, [userRoleFilter, userSearchText, userPageSize]);

  useEffect(() => {
    if (userPage > totalUserPages) {
      setUserPage(totalUserPages);
    }
  }, [userPage, totalUserPages]);

  const userRoleStats = {
    ALL: normalizedAdminUsers.length,
    ADMIN: normalizedAdminUsers.filter((user) => user.role === "ADMIN").length,
    PARTNER: normalizedAdminUsers.filter((user) => user.role === "PARTNER")
      .length,
    USER: normalizedAdminUsers.filter((user) => user.role === "USER").length,
    LOCKED: normalizedAdminUsers.filter((user) => !user.isActive).length,
  };

  const roleToneMap = {
    ADMIN: "rose",
    PARTNER: "emerald",
    USER: "slate",
  };

  const userLookupById = useMemo(
    () =>
      normalizedAdminUsers.reduce((acc, user) => {
        acc[user.id] = {
          fullName: user.fullName || "Chưa cập nhật tên",
          email: user.email || "Không có email",
          role: user.role,
        };
        return acc;
      }, {}),
    [normalizedAdminUsers],
  );

  const poiByTypeStats = useMemo(() => {
    const counter = {};
    for (const poi of allPoiRows) {
      counter[poi.type] = (counter[poi.type] || 0) + 1;
    }

    return Object.entries(counter)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [allPoiRows]);

  const partnerPoiStats = useMemo(() => {
    const counter = {};

    for (const poi of allPoiRows) {
      if (!poi.creatorId) continue;
      counter[poi.creatorId] = (counter[poi.creatorId] || 0) + 1;
    }

    return Object.entries(counter)
      .map(([creatorId, totalPois]) => {
        const creator = userLookupById[creatorId] || {};
        return {
          creatorId,
          totalPois,
          fullName: creator.fullName || creatorId,
          email: creator.email || "Không rõ email",
          role: creator.role || "UNKNOWN",
        };
      })
      .sort((a, b) => b.totalPois - a.totalPois)
      .slice(0, 10);
  }, [allPoiRows, userLookupById]);
  const partnerRegistrationRows = partnerRegistrationRequests
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      requester: item.requestedBy,
      shopName: item.shopName,
      shopAddress: item.shopAddress,
      status: item.status,
      note: item.note,
      decisionNote: item.decisionNote,
      reviewedAt: item.reviewedAt,
      createdAt: item.createdAt,
      tone: getPartnerRegistrationTone(item.status),
      label: getPartnerRegistrationLabel(item.status),
    }));

  const paymentPackageRows = useMemo(
    () =>
      [...paymentPackages]
        .sort((a, b) => {
          if (a.isActive !== b.isActive) {
            return Number(b.isActive) - Number(a.isActive);
          }

          return a.amount - b.amount;
        })
        .slice(0, 8),
    [paymentPackages],
  );

  // Protect this page - only ADMIN users can access
  if (userRole !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.20),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_24%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#111827_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[48px_48px] opacity-35" />
      <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-orange-500/18 blur-3xl" />
      <div className="absolute right-0 top-40 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative z-10 flex min-h-full">
        <aside className="hidden xl:flex w-80 flex-col gap-6 border-r border-white/10 bg-slate-950/55 p-6 backdrop-blur-xl">
          <div className="rounded-[30px] border border-white/10 bg-white/6 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-orange-500 to-rose-500 shadow-lg shadow-orange-500/25">
                <UtensilsCrossed size={22} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/45">
                  Quản trị hệ thống
                </p>
                <h2 className="text-xl font-black text-white">Phố Ẩm Thực</h2>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                <span className="inline-flex items-center gap-2 font-semibold">
                  <CheckCircle2 size={16} />
                  Backend đã kết nối
                </span>
                <span>Đang chạy</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white/70">
                <span className="inline-flex items-center gap-2 font-semibold">
                  <Clock3 size={16} />
                  Lần tải gần nhất
                </span>
                <span>{latestUpdatedLabel}</span>
              </div>
            </div>
          </div>

          <nav className="rounded-[30px] border border-white/10 bg-white/6 p-3 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
            {sidebarMenus.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition last:mb-0 ${
                    isActive
                      ? "bg-linear-to-r from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/20"
                      : "text-white/65 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 xl:px-8 xl:py-6">
          <section className="rounded-[34px] border border-white/10 bg-white/6 p-5 md:p-6 backdrop-blur-2xl shadow-[0_24px_80px_rgba(2,6,23,0.24)]">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <p className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-100">
                  <Sparkles size={12} />
                  Bảng điều khiển admin
                </p>
                <h1 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Trung tâm điều hành POI, tour và audio.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65 md:text-lg">
                  Theo dõi xuất bản, quản lý nội dung, kiểm tra đồng bộ và giữ
                  tài nguyên thuyết minh luôn sẵn sàng.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/12"
                >
                  Mở bản đồ
                </Link>
                <button
                  type="button"
                  onClick={() => setReloadTick((tick) => tick + 1)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-orange-500 to-rose-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:brightness-105"
                >
                  <ArrowUpRight size={16} />
                  Làm mới dữ liệu
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
              <div className="relative min-w-0">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
                  size={18}
                />
                <input
                  type="search"
                  placeholder="Tìm POI, tour, người dùng hoặc phiên bản nội dung"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/55 py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-white/35 outline-none ring-0 transition focus:border-orange-300/40 focus:bg-slate-950/75"
                />
              </div>
              <button
                type="button"
                className="rounded-2xl border border-white/10 bg-white/7 px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/12"
              >
                {isLoading ? "Đang tải" : "Bộ lọc"}
              </button>
              <button
                type="button"
                className="rounded-2xl border border-white/10 bg-white/7 px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/12"
              >
                Xuất dữ liệu
              </button>
            </div>
          </section>

          {loadError && (
            <section className="mt-6 rounded-[28px] border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100 backdrop-blur-xl">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">Cảnh báo dữ liệu backend</p>
                  <p className="mt-1 text-rose-100/80">{loadError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReloadTick((tick) => tick + 1)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-2 font-semibold text-rose-100 transition hover:bg-rose-300/15"
                >
                  Thử lại
                </button>
              </div>
            </section>
          )}

          {activeSection === "overview" && (
            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {dashboardStats.map((item) => (
                <DashboardMetric key={item.title} {...item} />
              ))}
            </section>
          )}

          {(activeSection === "overview" || activeSection === "analytics") && (
            <section className="mt-6 grid gap-6 xl:grid-cols-2">
              <div className="rounded-[34px] border border-white/10 bg-white/6 p-5 md:p-6 backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,0.24)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/45">
                      Thống kê POI
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      POI theo loại
                    </h2>
                  </div>
                  <StatusPill
                    tone={poiByTypeStats.length ? "emerald" : "slate"}
                  >
                    {formatNumber(poiByTypeStats.length)} loại
                  </StatusPill>
                </div>

                {poiByTypeStats.length === 0 ? (
                  <div className="mt-5 rounded-3xl border border-white/8 bg-black/10 p-4 text-sm text-white/60">
                    Chưa có dữ liệu POI để thống kê.
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {poiByTypeStats.map((item) => (
                      <div
                        key={item.type}
                        className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/10 px-4 py-3"
                      >
                        <span className="text-sm font-semibold text-white">
                          {item.type}
                        </span>
                        <span className="text-sm font-bold text-orange-200">
                          {formatNumber(item.count)} POI
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-[34px] border border-white/10 bg-white/6 p-5 md:p-6 backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,0.24)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/45">
                      Hiệu suất đối tác
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Mỗi partner tạo bao nhiêu POI
                    </h2>
                  </div>
                  <StatusPill
                    tone={partnerPoiStats.length ? "emerald" : "slate"}
                  >
                    Top {formatNumber(partnerPoiStats.length)}
                  </StatusPill>
                </div>

                {partnerPoiStats.length === 0 ? (
                  <div className="mt-5 rounded-3xl border border-white/8 bg-black/10 p-4 text-sm text-white/60">
                    Chưa có dữ liệu partner tạo POI.
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {partnerPoiStats.map((item) => (
                      <div
                        key={item.creatorId}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/10 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {item.fullName}
                          </p>
                          <p className="truncate text-xs text-white/50">
                            {item.email}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-emerald-200">
                            {formatNumber(item.totalPois)} POI
                          </p>
                          <p className="text-xs text-white/50">{item.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {activeSection === "partners" && (
            <section className="mt-6 rounded-[34px] border border-white/10 bg-white/6 p-5 md:p-6 backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,0.24)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/45">
                    Đăng ký đối tác
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-white">
                    Yêu cầu đăng ký
                  </h2>
                </div>
                <StatusPill
                  tone={partnerRegistrationRows.length ? "amber" : "slate"}
                >
                  {formatNumber(partnerRegistrationRows.length)} yêu cầu
                </StatusPill>
              </div>

              {partnerRegistrationRows.length === 0 ? (
                <div className="mt-5 rounded-[28px] border border-white/8 bg-black/10 p-4 text-sm text-white/60">
                  Chưa có yêu cầu đăng ký đối tác.
                </div>
              ) : (
                <div className="mt-5 grid gap-3">
                  {partnerRegistrationRows.map((item) => {
                    const isPending = item.status === "PENDING";
                    return (
                      <div
                        key={item.id}
                        className="rounded-[28px] border border-white/8 bg-black/10 p-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-white">
                                {item.shopName || "Yêu cầu chưa đặt tên"}
                              </p>
                              <StatusPill tone={item.tone}>
                                {item.label}
                              </StatusPill>
                            </div>
                            <p className="mt-1 text-sm text-white/60">
                              {item.shopAddress}
                            </p>
                            <p className="mt-2 text-xs text-white/45">
                              Người gửi: {item.requester} •{" "}
                              {formatRelativeTime(item.createdAt)}
                            </p>
                            {item.note && (
                              <p className="mt-2 text-sm text-white/70">
                                Ghi chú: {item.note}
                              </p>
                            )}
                            {item.decisionNote && (
                              <p className="mt-2 text-sm text-white/70">
                                Kết quả: {item.decisionNote}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            {isPending ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleReviewPartnerRegistrationRequest(
                                      item.id,
                                      "approve",
                                    )
                                  }
                                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105"
                                >
                                  Duyệt
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleReviewPartnerRegistrationRequest(
                                      item.id,
                                      "reject",
                                    )
                                  }
                                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/15"
                                >
                                  Từ chối
                                </button>
                              </>
                            ) : (
                              <span className="inline-flex items-center rounded-2xl border border-white/10 bg-white/8 px-4 py-2 text-sm font-semibold text-white/70">
                                Đã xử lý{" "}
                                {item.reviewedAt
                                  ? formatRelativeTime(item.reviewedAt)
                                  : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {activeSection === "pricing" && (
            <section className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[34px] border border-white/10 bg-linear-to-br from-cyan-500/18 via-slate-900/70 to-slate-950/80 p-5 md:p-6 backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,0.24)]">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-100/70">
                  Cấu hình giá gói
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">
                  Tạo gói thanh toán mới
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65">
                  Mã gói sẽ được hệ thống tạo tự động. Admin chỉ cần đặt tên,
                  giá, số ngày hiệu lực và số POI tối đa được phép xuất bản.
                </p>
                {editingPackageCode && (
                  <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
                    Đang chỉnh sửa gói: {editingPackageCode}
                    <button
                      type="button"
                      onClick={resetPackageForm}
                      className="ml-3 font-semibold underline underline-offset-4"
                    >
                      Hủy chỉnh sửa
                    </button>
                  </div>
                )}

                <form
                  className="mt-6 space-y-4"
                  onSubmit={handleCreatePaymentPackage}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                        Tên gói
                      </span>
                      <input
                        type="text"
                        value={packageForm.name}
                        onChange={(e) =>
                          handlePackageFormChange("name", e.target.value)
                        }
                        placeholder="Premium 30 ngày"
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                        Giá
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={packageForm.amount}
                        onChange={(e) =>
                          handlePackageFormChange("amount", e.target.value)
                        }
                        placeholder="99000"
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                        Tiền tệ
                      </span>
                      <input
                        type="text"
                        value={packageForm.currency}
                        onChange={(e) =>
                          handlePackageFormChange("currency", e.target.value)
                        }
                        placeholder="VND"
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                        Số ngày hiệu lực
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={packageForm.durationDays}
                        onChange={(e) =>
                          handlePackageFormChange(
                            "durationDays",
                            e.target.value,
                          )
                        }
                        placeholder="30"
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                        Số POI được phép
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={packageForm.poiQuota}
                        onChange={(e) =>
                          handlePackageFormChange("poiQuota", e.target.value)
                        }
                        placeholder="5"
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                      Mô tả
                    </span>
                    <textarea
                      value={packageForm.description}
                      onChange={(e) =>
                        handlePackageFormChange("description", e.target.value)
                      }
                      rows="4"
                      placeholder="Dùng cho gói premium 30 ngày"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    />
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={packageForm.isActive}
                      onChange={(e) =>
                        handlePackageFormChange("isActive", e.target.checked)
                      }
                      className="h-4 w-4 rounded border-white/20 bg-slate-950/55 text-cyan-400"
                    />
                    <span className="text-sm font-semibold text-white/80">
                      Kích hoạt ngay sau khi tạo
                    </span>
                  </label>

                  {(packageError || packageSuccess) && (
                    <div
                      className={`rounded-2xl border p-4 text-sm ${
                        packageError
                          ? "border-rose-300/20 bg-rose-400/10 text-rose-100"
                          : "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                      }`}
                    >
                      {packageError || packageSuccess}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingPackage}
                    className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-cyan-500 to-sky-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-105 disabled:opacity-50"
                  >
                    {isSavingPackage
                      ? "Đang lưu..."
                      : editingPackageCode
                        ? "Lưu gói giá"
                        : "Tạo gói giá"}
                  </button>
                </form>
              </div>

              <div className="rounded-[34px] border border-white/10 bg-white/6 p-5 md:p-6 backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,0.24)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/45">
                      Danh sách gói
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Gói giá đang cấu hình
                    </h2>
                  </div>
                  <StatusPill
                    tone={paymentPackageRows.length ? "emerald" : "slate"}
                  >
                    {formatNumber(paymentPackageRows.length)} gói
                  </StatusPill>
                </div>

                <div className="mt-5 grid gap-3">
                  {paymentPackageRows.length === 0 ? (
                    <div className="rounded-3xl border border-white/8 bg-black/10 p-4 text-sm text-white/60">
                      Chưa có gói giá nào được tạo.
                    </div>
                  ) : (
                    paymentPackageRows.map((item) => (
                      <div
                        key={item.code}
                        className="rounded-3xl border border-white/8 bg-black/10 p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-white">
                                {item.name}
                              </p>
                              <StatusPill
                                tone={item.isActive ? "emerald" : "slate"}
                              >
                                {item.isActive ? "Đang bật" : "Tắt"}
                              </StatusPill>
                            </div>
                            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/45">
                              {item.code}
                            </p>
                            <p className="mt-3 text-sm font-bold text-cyan-100">
                              {formatCurrency(item.amount, item.currency)}
                            </p>
                            <p className="mt-1 text-sm text-white/60">
                              Thời hạn: {formatNumber(item.durationDays)} ngày
                            </p>
                            <p className="mt-1 text-sm text-white/60">
                              Tối đa {formatNumber(item.poiQuota)} POI
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              Tạo {formatRelativeTime(item.createdAt)}
                              {item.createdBy ? ` • bởi ${item.createdBy}` : ""}
                            </p>
                            {item.description && (
                              <p className="mt-2 text-sm leading-relaxed text-white/70">
                                {item.description}
                              </p>
                            )}
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditPaymentPackage(item)}
                                className="rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/12"
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTogglePaymentPackage(item)}
                                className="rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/12"
                              >
                                {item.isActive ? "Tắt" : "Bật"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePaymentPackage(item)}
                                className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/15"
                              >
                                Xóa
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}

          {activeSection === "users" && (
            <section className="mt-6 rounded-[34px] border border-white/10 bg-white/6 p-5 md:p-6 backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,0.24)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/45">
                    Quản lý người dùng
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-white">
                    User và Partner
                  </h2>
                </div>
                <StatusPill
                  tone={filteredAdminUsers.length ? "emerald" : "slate"}
                >
                  {formatNumber(filteredAdminUsers.length)} /{" "}
                  {formatNumber(userRoleStats.ALL)}
                </StatusPill>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                  <p className="text-xs text-white/45">Tổng tài khoản</p>
                  <p className="mt-1 text-xl font-bold text-white">
                    {formatNumber(userRoleStats.ALL)}
                  </p>
                </div>
                <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3">
                  <p className="text-xs text-rose-100/70">ADMIN</p>
                  <p className="mt-1 text-xl font-bold text-rose-100">
                    {formatNumber(userRoleStats.ADMIN)}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3">
                  <p className="text-xs text-emerald-100/70">PARTNER</p>
                  <p className="mt-1 text-xl font-bold text-emerald-100">
                    {formatNumber(userRoleStats.PARTNER)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/8 px-4 py-3">
                  <p className="text-xs text-white/55">USER</p>
                  <p className="mt-1 text-xl font-bold text-white">
                    {formatNumber(userRoleStats.USER)}
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3">
                  <p className="text-xs text-amber-100/70">ĐÃ KHÓA</p>
                  <p className="mt-1 text-xl font-bold text-amber-100">
                    {formatNumber(userRoleStats.LOCKED)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
                <div className="relative min-w-0">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
                    size={16}
                  />
                  <input
                    type="search"
                    value={userSearchText}
                    onChange={(e) => setUserSearchText(e.target.value)}
                    placeholder="Tìm theo tên, email hoặc vai trò"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/55 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-orange-300/40"
                  />
                </div>

                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm font-semibold text-white outline-none"
                >
                  <option value="ALL">Tất cả vai trò</option>
                  <option value="USER">USER</option>
                  <option value="PARTNER">PARTNER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>

                <select
                  value={String(userPageSize)}
                  onChange={(e) => setUserPageSize(Number(e.target.value))}
                  className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm font-semibold text-white outline-none"
                >
                  <option value="10">10 / trang</option>
                  <option value="20">20 / trang</option>
                  <option value="50">50 / trang</option>
                </select>
              </div>

              {filteredAdminUsers.length === 0 ? (
                <div className="mt-5 rounded-[28px] border border-white/8 bg-black/10 p-4 text-sm text-white/60">
                  Không có tài khoản phù hợp bộ lọc.
                </div>
              ) : (
                <>
                  <div className="mt-5 overflow-hidden rounded-[28px] border border-white/8 bg-black/10">
                    <div className="grid grid-cols-[1.8fr_2fr_0.9fr_1fr_1fr_2.3fr] gap-3 border-b border-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white/45">
                      <span>Người dùng</span>
                      <span>Email</span>
                      <span>Vai trò</span>
                      <span>Trạng thái</span>
                      <span>Tạo</span>
                      <span className="text-right">Hành động</span>
                    </div>

                    <div className="divide-y divide-white/8">
                      {pagedAdminUsers.map((user) => (
                        <div
                          key={user.id}
                          className="grid grid-cols-[1.8fr_2fr_0.9fr_1fr_1fr_2.3fr] items-center gap-3 px-4 py-4 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">
                              {user.fullName || "Chưa cập nhật tên"}
                            </p>
                            <p className="mt-1 truncate text-xs text-white/45">
                              ID: {user.id}
                            </p>
                          </div>

                          <p className="truncate text-white/80">{user.email}</p>

                          <StatusPill tone={roleToneMap[user.role] ?? "slate"}>
                            {user.role}
                          </StatusPill>

                          <StatusPill
                            tone={user.isActive ? "emerald" : "amber"}
                          >
                            {user.isActive ? "Hoạt động" : "Đã khóa"}
                          </StatusPill>

                          <p className="text-xs text-white/60">
                            {formatRelativeTime(user.createdAt)}
                          </p>

                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                requestUpdateUserRole(user.id, "PARTNER")
                              }
                              disabled={
                                isUpdatingUserRoleId === user.id ||
                                user.role === "PARTNER"
                              }
                              className="inline-flex items-center rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100 disabled:opacity-50"
                            >
                              PARTNER
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                requestUpdateUserRole(user.id, "ADMIN")
                              }
                              disabled={
                                isUpdatingUserRoleId === user.id ||
                                user.role === "ADMIN"
                              }
                              className="inline-flex items-center rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-100 disabled:opacity-50"
                            >
                              ADMIN
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                requestUpdateUserRole(user.id, "USER")
                              }
                              disabled={
                                isUpdatingUserRoleId === user.id ||
                                user.role === "USER"
                              }
                              className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              USER
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                requestUpdateUserAccess(user.id, true)
                              }
                              disabled={
                                isUpdatingUserAccessId === user.id ||
                                !user.isActive ||
                                user.role === "ADMIN"
                              }
                              title={
                                user.role === "ADMIN"
                                  ? "Tài khoản ADMIN không được khóa"
                                  : "Khóa tài khoản"
                              }
                              className="inline-flex items-center rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-100 disabled:opacity-50"
                            >
                              Khóa
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                requestUpdateUserAccess(user.id, false)
                              }
                              disabled={
                                isUpdatingUserAccessId === user.id ||
                                user.isActive
                              }
                              className="inline-flex items-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50"
                            >
                              Mở khóa
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-white/65">
                    <span>
                      Trang {userPage}/{totalUserPages} • Hiển thị{" "}
                      {formatNumber(pagedAdminUsers.length)} /{" "}
                      {formatNumber(filteredAdminUsers.length)}
                    </span>
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                        disabled={userPage <= 1}
                        className="rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        Trước
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setUserPage((p) => Math.min(totalUserPages, p + 1))
                        }
                        disabled={userPage >= totalUserPages}
                        className="rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {activeSection === "pois" && (
            <section className="mt-6 rounded-[34px] border border-white/10 bg-white/6 p-5 md:p-6 backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,0.24)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/45">
                    Danh sách POI
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-white">
                    Theo dõi theo loại
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={poiTypeFilter}
                    onChange={(e) => setPoiTypeFilter(e.target.value)}
                    className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm font-semibold text-white outline-none"
                  >
                    <option value="ALL">Tất cả loại POI</option>
                    {poiTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/12"
                  >
                    <Settings2 size={16} />
                    Cài đặt bảng
                  </button>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-[28px] border border-white/8 bg-black/10">
                <div className="grid grid-cols-[0.8fr_2fr_0.7fr_0.9fr_0.9fr_1fr] gap-3 border-b border-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                  <span>Loại</span>
                  <span>Tên</span>
                  <span>Phiên bản</span>
                  <span>Trạng thái</span>
                  <span>Cập nhật</span>
                  <span className="text-right">Thao tác</span>
                </div>

                <div className="divide-y divide-white/8">
                  {queueRows.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-white/55">
                      Chưa tải được POI từ backend.
                    </div>
                  ) : (
                    queueRows.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[0.8fr_2fr_0.7fr_0.9fr_0.9fr_1fr] items-center gap-3 px-4 py-4 text-sm"
                      >
                        <div className="font-semibold text-white/80">
                          {item.type}
                        </div>
                        <div>
                          <p className="font-semibold text-white">
                            {item.name}
                          </p>
                          <p className="mt-1 text-xs text-white/45">
                            Bản ghi nội dung đa ngôn ngữ
                          </p>
                        </div>
                        <div className="text-white/60">{item.version}</div>
                        <div>
                          <StatusPill tone={item.tone}>
                            {item.status}
                          </StatusPill>
                        </div>
                        <div className="text-white/60">{item.updated}</div>
                        <div className="text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditPoi(item.id)}
                              disabled={activePoiActionId === item.id}
                              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:opacity-50"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleTogglePoiPublish(
                                  item.id,
                                  !item.isPublished,
                                )
                              }
                              disabled={activePoiActionId === item.id}
                              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/15 disabled:opacity-50"
                            >
                              {item.isPublished ? "Unpublish" : "Publish"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePoi(item.id)}
                              disabled={activePoiActionId === item.id}
                              className="inline-flex items-center gap-2 rounded-2xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/15 disabled:opacity-50"
                            >
                              {activePoiActionId === item.id
                                ? "Đang xử lý..."
                                : "Xóa"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-white/55">
                <span>{formatNumber(totalPois)} POI đã tải</span>
                <span>
                  Lọc theo loại:{" "}
                  {poiTypeFilter === "ALL" ? "Tất cả" : poiTypeFilter} • Hiển
                  thị {formatNumber(queueRows.length)}/
                  {formatNumber(filteredPoiRows.length)}
                </span>
              </div>
            </section>
          )}

          {activeSection === "settings" && (
            <section className="mt-6 rounded-[34px] border border-white/10 bg-white/6 p-5 md:p-6 backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,0.24)]">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/45">
                Cài đặt
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">
                Cấu hình hệ thống
              </h2>
              <div className="mt-5 rounded-2xl border border-white/8 bg-black/10 p-4 text-sm text-white/70">
                Khu vực cài đặt đang được chuẩn hóa. Bạn có thể bổ sung các cấu
                hình hệ thống tại đây theo nhu cầu vận hành.
              </div>
            </section>
          )}
        </main>
      </div>

      {pendingUserAction && confirmDialogContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Đóng xác nhận"
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            onClick={() => !isConfirmingAction && setPendingUserAction(null)}
            disabled={isConfirmingAction}
          />

          <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
            <h3 className="text-xl font-black text-white">
              {confirmDialogContent.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              {confirmDialogContent.message}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingUserAction(null)}
                disabled={isConfirmingAction}
                className="rounded-2xl border border-white/15 bg-white/8 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/12 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmUserAction}
                disabled={isConfirmingAction}
                className="rounded-2xl bg-linear-to-r from-orange-500 to-rose-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:brightness-105 disabled:opacity-50"
              >
                {isConfirmingAction
                  ? "Đang xử lý..."
                  : confirmDialogContent.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {isPoiEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-6 md:items-center">
          <button
            type="button"
            aria-label="Đóng chỉnh sửa POI"
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            onClick={closePoiEditModal}
            disabled={isSavingPoiEdit}
          />

          <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
            <div className="border-b border-white/10 px-5 py-4 md:px-6">
              <h3 className="text-xl font-black text-white">Chỉnh sửa POI</h3>
              <p className="mt-1 text-sm text-white/65">ID: {poiEditForm.id}</p>
            </div>

            <form
              className="max-h-[75vh] space-y-4 overflow-y-auto px-5 py-4 md:px-6"
              onSubmit={handleSubmitPoiEdit}
            >
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                  Ảnh POI
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePickPoiEditImage}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-cyan-100 file:px-3 file:py-1 file:text-cyan-800"
                />

                {poiEditImagePreviewUrl ? (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 p-3">
                    <p className="mb-2 text-xs font-semibold text-cyan-100/80">
                      {poiEditImageFile
                        ? "Ảnh mới sẽ được upload"
                        : "Ảnh hiện tại"}
                    </p>
                    <img
                      src={poiEditImagePreviewUrl}
                      alt="POI preview"
                      className="h-52 w-full rounded-xl object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        revokeBlobUrl(poiEditImagePreviewUrl);
                        setPoiEditImageFile(null);
                        setPoiEditImagePreviewUrl("");
                      }}
                      className="mt-3 rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/12"
                    >
                      {poiEditImageFile ? "Bỏ chọn ảnh mới" : "Ẩn preview ảnh"}
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-white/45">
                    Chưa có ảnh preview. Bạn có thể chọn ảnh mới để thay thế ảnh
                    hiện tại.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                      Tên POI
                    </span>
                    <input
                      type="text"
                      value={poiEditForm.name}
                      onChange={(e) =>
                        handlePoiEditFieldChange("name", e.target.value)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                      Loại POI
                    </span>
                    <select
                      value={poiEditForm.type}
                      onChange={(e) =>
                        handlePoiEditFieldChange("type", e.target.value)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    >
                      <option value="FOOD">FOOD</option>
                      <option value="DRINK">DRINK</option>
                      <option value="SNACK">SNACK</option>
                      <option value="WC">WC</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                      Latitude
                    </span>
                    <input
                      type="number"
                      step="0.000001"
                      value={poiEditForm.latitude}
                      onChange={(e) =>
                        handlePoiEditFieldChange("latitude", e.target.value)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                      Longitude
                    </span>
                    <input
                      type="number"
                      step="0.000001"
                      value={poiEditForm.longitude}
                      onChange={(e) =>
                        handlePoiEditFieldChange("longitude", e.target.value)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                      Bán kính (m)
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={poiEditForm.radius}
                      onChange={(e) =>
                        handlePoiEditFieldChange("radius", e.target.value)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                    Mô tả
                  </span>
                  <textarea
                    rows="4"
                    value={poiEditForm.description}
                    onChange={(e) =>
                      handlePoiEditFieldChange("description", e.target.value)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                  />
                </label>
              </div>

              {poiEditError && (
                <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">
                  {poiEditError}
                </div>
              )}

              <div className="sticky bottom-0 mt-2 flex justify-end gap-3 border-t border-white/10 bg-slate-900/95 px-1 py-3">
                <button
                  type="button"
                  onClick={closePoiEditModal}
                  disabled={isSavingPoiEdit}
                  className="rounded-2xl border border-white/15 bg-white/8 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/12 disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingPoiEdit}
                  className="rounded-2xl bg-linear-to-r from-cyan-500 to-sky-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-105 disabled:opacity-50"
                >
                  {isSavingPoiEdit ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
