import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { authAPI, usersAPI } from "../lib/api";
import { useLanguage, useTranslation } from "../hooks/useLanguageContext";
import { useToast } from "../hooks/useToast";

function formatDate(dateValue, locale) {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function Profile() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [fullNameInput, setFullNameInput] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const { language } = useLanguage();
  const t = useTranslation();
  const profileT = t.profile || {};
  const { showSuccess, showError, showInfo } = useToast();
  const token = localStorage.getItem("accessToken");
  const userRole = String(profile?.role || "USER").toUpperCase();
  const isPartner = userRole === "PARTNER";

  const locale = useMemo(() => {
    switch (language) {
      case "en":
        return "en-US";
      case "ja":
        return "ja-JP";
      case "ko":
        return "ko-KR";
      case "zh":
        return "zh-CN";
      case "th":
        return "th-TH";
      default:
        return "vi-VN";
    }
  }, [language]);

  useEffect(() => {
    if (!token) return;

    const loadProfile = async () => {
      try {
        setIsLoading(true);
        setError("");
        const response = await usersAPI.getProfile();
        const userData = response?.data || response;
        setProfile(userData);
        if (userData?.role && !localStorage.getItem("uiRole")) {
          localStorage.setItem("uiRole", String(userData.role).toUpperCase());
        }
        setFullNameInput(userData?.fullName || "");
      } catch (err) {
        setError(err?.message || profileT.loadProfileFailed || t.common.error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [token, profileT.loadProfileFailed, t.common.error]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const handleUpdateName = async (e) => {
    e.preventDefault();

    const nextName = fullNameInput.trim();
    if (!nextName) {
      showError(profileT.nameRequired || t.common.error);
      return;
    }

    if (nextName === (profile?.fullName || "")) {
      showInfo(profileT.nameUnchanged || t.common.info);
      return;
    }

    try {
      setIsUpdatingName(true);
      const res = await usersAPI.updateProfile(nextName);
      const updated = res?.data || {};
      setProfile((prev) => ({
        ...prev,
        ...updated,
        fullName: updated.fullName || nextName,
      }));
      showSuccess(profileT.updateNameSuccess || t.toast.successTitle);
    } catch (err) {
      showError(err?.message || profileT.updateNameFailed || t.common.error);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      showError(profileT.passwordFieldsRequired || t.common.error);
      return;
    }

    if (newPassword.length < 6) {
      showError(profileT.passwordMinLength || t.common.error);
      return;
    }

    if (newPassword !== confirmPassword) {
      showError(profileT.passwordConfirmMismatch || t.common.error);
      return;
    }

    try {
      setIsChangingPassword(true);
      const res = await authAPI.changePassword(currentPassword, newPassword);
      const message =
        res?.message || profileT.passwordChangeSuccess || t.toast.successTitle;
      showSuccess(message);

      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");

      setTimeout(() => {
        window.location.href = "/login";
      }, 1000);
    } catch (err) {
      showError(
        err?.message || profileT.passwordChangeFailed || t.common.error,
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="w-full min-h-full bg-slate-50 p-4 md:p-6">
      <div className="h-full w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-orange-500">
          {t.nav.profile}
        </p>
        <div className="mb-6">
          <h1 className="text-3xl font-black text-slate-900">
            {profileT.welcomeBack || "WELCOME BACK"}{" "}
            {profile?.fullName || t.nav.profile}
          </h1>
        </div>

        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
            {t.common.loading}
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {!isLoading && !error && profile && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {profileT.idLabel || "ID"}
              </p>
              <p className="break-all text-sm font-medium text-slate-800">
                {profile.id}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t.auth.email}
              </p>
              <p className="text-sm font-medium text-slate-800">
                {profile.email || "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t.auth.fullName}
              </p>
              <p className="text-sm font-medium text-slate-800">
                {profile.fullName || "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 md:col-span-2 xl:col-span-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-800">
                    {profileT.partnerZoneTitle || "Partner zone"}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    {isPartner
                      ? profileT.partnerZoneActive
                      : profileT.partnerZoneInactive}
                  </p>
                </div>
                <Link
                  to="/partner-profile"
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  {isPartner ? profileT.goPartnerPage : profileT.becomePartner}
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2 xl:col-span-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {profileT.createdAtLabel || "Created At"}
              </p>
              <p className="text-sm font-medium text-slate-800">
                {formatDate(profile.createdAt, locale)}
              </p>
            </div>

            <form
              onSubmit={handleUpdateName}
              className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2 xl:col-span-3"
            >
              <p className="mb-3 text-sm font-semibold text-slate-900">
                {profileT.changeDisplayName}
              </p>
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  type="text"
                  value={fullNameInput}
                  onChange={(e) => setFullNameInput(e.target.value)}
                  placeholder={profileT.newNamePlaceholder}
                  className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500"
                />
                <button
                  type="submit"
                  disabled={isUpdatingName}
                  className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {isUpdatingName ? profileT.saving : profileT.saveName}
                </button>
              </div>
            </form>

            <form
              onSubmit={handleChangePassword}
              className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2 xl:col-span-3"
            >
              <p className="mb-3 text-sm font-semibold text-slate-900">
                {profileT.changePasswordTitle}
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={profileT.currentPasswordPlaceholder}
                  className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={profileT.newPasswordPlaceholder}
                  className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={profileT.confirmPasswordPlaceholder}
                  className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500"
                />
              </div>
              <div className="mt-3">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="h-11 rounded-xl bg-orange-500 px-5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                >
                  {isChangingPassword
                    ? profileT.changingPassword
                    : profileT.changePasswordAction}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
