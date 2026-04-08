import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

const resources = {
  en: {
    translation: {
      "home": "Home",
      "profile": "Profile",
      "change_password": "Change Password",
      "update_name": "Update Name",
      "save": "Save",
    }
  },
  vi: {
    translation: {
      "home": "Trang chủ",
      "profile": "Cá nhân",
      "change_password": "Đổi mật khẩu",
      "update_name": "Cập nhật họ tên",
      "save": "Lưu lại",
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'vi', // Mặc định là tiếng Việt
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
  });

export default i18n;