import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/api';
import { autoTranslate } from "../utils/translator";
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen({ navigation, route }) {
  const { currentLang } = route.params || { currentLang: { code: 'vi', locale: 'vi-VN' } };

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPass, setLoadingPass] = useState(false);

  const [labels, setLabels] = useState({
    profileHeader: "THÔNG TIN CÁ NHÂN",
    emailLabel: "Địa chỉ Email",
    nameLabel: "Họ và tên",
    placeholderName: "Nhập tên mới...",
    btnUpdate: "CẬP NHẬT TÊN",
    securityHeader: "BẢO MẬT MẬT KHẨU",
    oldPassLabel: "Mật khẩu hiện tại",
    oldPassPlaceholder: "Nhập mật khẩu hiện tại",
    newPassLabel: "Mật khẩu mới",
    newPassPlaceholder: "Tối thiểu 6 ký tự",
    confirmPassLabel: "Xác nhận mật khẩu",
    confirmPassPlaceholder: "Nhập lại mật khẩu mới",
    btnChangePass: "ĐỔI MẬT KHẨU",
    loadingText: "Đang tải dữ liệu...",
    successTitle: "Thành công",
    errorTitle: "Lỗi",
    updateSuccess: "Đã cập nhật tên thành công!",
    updateFail: "Cập nhật tên thất bại",
    changePassSuccess: "Mật khẩu đã được thay đổi",
    changePassFail: "Mật khẩu hiện tại không chính xác",
    emptyName: "Tên không được để trống",
    emptyPass: "Vui lòng nhập đầy đủ thông tin mật khẩu"
  });

  useEffect(() => {
    loadData();
    translateUI();
  }, []);

  const translateUI = async () => {
    if (currentLang.code === 'vi') return;
    try {
      const keys = Object.keys(labels);
      const values = Object.values(labels);
      const translatedValues = await Promise.all(
        values.map(val => autoTranslate(val, currentLang.code))
      );
      const newLabels = {};
      keys.forEach((key, index) => { newLabels[key] = translatedValues[index]; });
      setLabels(newLabels);
      const translatedTitle = await autoTranslate("Hồ sơ cá nhân", currentLang.code);
      navigation.setOptions({ title: `👤 ${translatedTitle}` });
    } catch (e) { console.log("Lỗi dịch:", e); }
  };

  const loadData = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await API.get("/users/profile", { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const userData = response.data.data || response.data;
      if (userData) {
        setFullName(userData.fullName || "");
        setEmail(userData.email || "");
      }
    } catch (e) {
      const sName = await AsyncStorage.getItem('userName');
      const sEmail = await AsyncStorage.getItem('userEmail');
      if (sName) setFullName(sName);
      if (sEmail) setEmail(sEmail);
    }
  };

const handleUpdateName = async () => {
  if (!fullName.trim()) {
    Alert.alert(labels.errorTitle, labels.emptyName); // Dùng label đã dịch
    return;
  }
  setLoadingProfile(true);
  try {
    const token = await AsyncStorage.getItem('userToken');
    await API.patch("/users/profile", { fullName: fullName.trim() }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    await AsyncStorage.setItem('userName', fullName.trim());
    
    // Hiện thông báo đã dịch
    Alert.alert(labels.successTitle, labels.updateSuccess); 
  } catch (error) {
    Alert.alert(labels.errorTitle, labels.updateFail);
  } finally {
    setLoadingProfile(false);
  }
};

const handleChangePassword = async () => {
  if (!oldPassword || !newPassword || !confirmPassword) {
    Alert.alert(labels.errorTitle, labels.emptyPass);
    return;
  }
  setLoadingPass(true);
  try {
    const token = await AsyncStorage.getItem('userToken');
    await API.post("/users/change-password", { oldPassword, newPassword }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    // Hiện thông báo đã dịch
    Alert.alert(labels.successTitle, labels.changePassSuccess);
    setOldPassword(''); setNewPassword(''); setConfirmPassword('');
  } catch (error) {
    Alert.alert(labels.errorTitle, labels.changePassFail);
  } finally {
    setLoadingPass(false);
  }
};

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F8F9FA' }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar barStyle="dark-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Header Section */}
        <View style={styles.headerBackground}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarTextLarge}>
                {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
            <TouchableOpacity style={styles.cameraIcon}>
              <Ionicons name="camera" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerName}>{fullName || labels.loadingText}</Text>
          <Text style={styles.headerEmailSub}>{email}</Text>
        </View>

        <View style={styles.contentContainer}>
          {/* Card: Profile Info */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{labels.profileHeader}</Text>
            
            <Text style={styles.label}>{labels.emailLabel}</Text>
            <View style={[styles.inputWrapper, styles.disabledWrapper]}>
              <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput style={styles.inputDisabled} value={email} editable={false} />
            </View>

            <Text style={styles.label}>{labels.nameLabel}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color="#FF6F00" style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                value={fullName} 
                onChangeText={setFullName}
                placeholder={labels.placeholderName}
              />
            </View>
            
            <TouchableOpacity style={styles.updateBtn} onPress={handleUpdateName}>
              {loadingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{labels.btnUpdate}</Text>}
            </TouchableOpacity>
          </View>

          {/* Card: Security */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{labels.securityHeader}</Text>

            <View style={styles.inputWrapper}>
              <Ionicons name="shield-outline" size={20} color="#FF6F00" style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                secureTextEntry 
                value={oldPassword}
                onChangeText={setOldPassword}
                placeholder={labels.oldPassPlaceholder}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#FF6F00" style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                secureTextEntry 
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={labels.newPassPlaceholder}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#FF6F00" style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                secureTextEntry 
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={labels.confirmPassPlaceholder}
              />
            </View>

            <TouchableOpacity style={[styles.updateBtn, {backgroundColor: '#2D3436'}]} onPress={handleChangePassword}>
              {loadingPass ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{labels.btnChangePass}</Text>}
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerBackground: { 
    alignItems: 'center', 
    paddingTop: 40, 
    paddingBottom: 30, 
    backgroundColor: '#FFF3E0',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10
  },
  avatarContainer: { position: 'relative' },
  avatarLarge: { 
    width: 100, height: 100, borderRadius: 50, 
    backgroundColor: '#FF6F00', justifyContent: 'center', 
    alignItems: 'center', borderWidth: 4, borderColor: '#fff' 
  },
  avatarTextLarge: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  cameraIcon: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#333', padding: 8, borderRadius: 20,
    borderWidth: 2, borderColor: '#fff'
  },
  headerName: { marginTop: 15, fontSize: 22, fontWeight: 'bold', color: '#333' },
  headerEmailSub: { color: '#777', fontSize: 14, marginTop: 4 },
  
  contentContainer: { paddingHorizontal: 20, marginTop: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5
  },
  sectionTitle: { 
    fontSize: 15, fontWeight: 'bold', color: '#FF6F00', 
    marginBottom: 20, letterSpacing: 0.5 
  },
  label: { fontSize: 13, color: '#95A5A6', marginBottom: 8, fontWeight: '600', marginLeft: 5 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F2F6',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E1E2E6'
  },
  disabledWrapper: { backgroundColor: '#F8F9FA', borderColor: '#F1F2F6' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#2C3E50' },
  inputDisabled: { flex: 1, fontSize: 15, color: '#BDC3C7' },
  updateBtn: { 
    backgroundColor: '#FF6F00', 
    height: 50, borderRadius: 12, 
    justifyContent: 'center', alignItems: 'center',
    marginTop: 10,
    elevation: 2
  },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15, letterSpacing: 1 }
});