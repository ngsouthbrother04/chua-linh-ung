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
  Platform 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/api';
import { useTranslation } from 'react-i18next';
import '../i18n/i18n'; // Import file cấu hình
export default function ProfileScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const { t, i18n } = useTranslation();
  // State mật khẩu
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPass, setLoadingPass] = useState(false);

  useEffect(() => {
    loadData();
  }, []);
    const changeLanguage = (lng) => {
    i18n.changeLanguage(lng); // Hàm này sẽ đổi ngôn ngữ toàn App ngay lập tức
  };
  const loadData = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await API.get("/users/profile", {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Kiểm tra log ở terminal debug
      console.log("DỮ LIỆU SERVER TRẢ VỀ:", response.data);

      if (response.data && response.data.data) {
        setFullName(response.data.data.fullName);
        setEmail(response.data.data.email);
        
        // Cập nhật lại local để các màn hình khác (Home) cũng nhận tên mới
        await AsyncStorage.setItem('userName', response.data.data.fullName);
        await AsyncStorage.setItem('userEmail', response.data.data.email);
      }
    } catch (e) {
      console.log("Lỗi tải thông tin (sử dụng dữ liệu local):", e);
      const sName = await AsyncStorage.getItem('userName');
      const sEmail = await AsyncStorage.getItem('userEmail');
      if (sName) setFullName(sName);
      if (sEmail) setEmail(sEmail);
    }
  };

  // HÀM 1: CẬP NHẬT HỌ TÊN
  const handleUpdateName = async () => {
    if (!fullName.trim()) {
      Alert.alert("Lỗi", "Họ tên không được để trống.");
      return;
    }

    setLoadingProfile(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await API.patch("/users/profile", {
        fullName: fullName.trim(),
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 200 || response.status === 204) {
        await AsyncStorage.setItem('userName', fullName.trim());
        Alert.alert("Thành công", "Đã cập nhật họ tên mới!");
      }
    } catch (error) {
      console.log("Lỗi Update Name:", error.response?.data || error.message);
      Alert.alert("Lỗi", "Không thể cập nhật tên. Vui lòng kiểm tra Server.");
    } finally {
      setLoadingProfile(false);
    }
  };

  // HÀM 2: ĐỔI MẬT KHẨU
  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ các ô mật khẩu.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Lỗi", "Mật khẩu xác nhận không khớp.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Lỗi", "Mật khẩu mới phải từ 6 ký tự trở lên.");
      return;
    }

    setLoadingPass(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await API.post("/users/change-password", {
        oldPassword: oldPassword,
        newPassword: newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 200) {
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        Alert.alert("Thành công", "Mật khẩu đã được thay đổi.");
      }
    } catch (error) {
      const msg = error.response?.data?.message || "Mật khẩu cũ không đúng.";
      Alert.alert("Thất bại", msg);
    } finally {
      setLoadingPass(false);
    }
  };

  return (
    
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0} 
    >
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={{ paddingBottom: 60 }} 
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar & Email Header */}
        <View style={styles.header}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>
              {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <Text style={styles.headerEmail}>{email || "Đang tải..."}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>👤 THÔNG TIN CÁ NHÂN</Text>
          
          <Text style={styles.label}>Email (Tài khoản)</Text>
          <TextInput 
            style={[styles.input, styles.disabledInput]} 
            value={email} 
            editable={false} 
          />

          <Text style={styles.label}>Họ và tên</Text>
          <TextInput 
            style={styles.input} 
            value={fullName} 
            onChangeText={setFullName}
            placeholder="Nhập tên mới..."
          />
          
          <TouchableOpacity 
            style={styles.smallBtn} 
            onPress={handleUpdateName} 
            disabled={loadingProfile}
          >
            {loadingProfile ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>CẬP NHẬT TÊN</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>🔑 BẢO MẬT MẬT KHẨU</Text>

          <Text style={styles.label}>Mật khẩu cũ</Text>
          <TextInput 
            style={styles.input} 
            secureTextEntry 
            value={oldPassword}
            onChangeText={setOldPassword}
            placeholder="Nhập mật khẩu hiện tại"
          />

          <Text style={styles.label}>Mật khẩu mới</Text>
          <TextInput 
            style={styles.input} 
            secureTextEntry 
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Nhập mật khẩu mới"
          />

          <Text style={styles.label}>Xác nhận mật khẩu mới</Text>
          <TextInput 
            style={styles.input} 
            secureTextEntry 
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Nhập lại mật khẩu mới"
          />

          <TouchableOpacity 
            style={[styles.smallBtn, {backgroundColor: '#333', marginBottom: 20}]} 
            onPress={handleChangePassword} 
            disabled={loadingPass}
          >
            {loadingPass ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>ĐỔI MẬT KHẨU</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { alignItems: 'center', padding: 30, backgroundColor: '#FFF3E0' },
  avatarLarge: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: '#FF6F00', 
    justifyContent: 'center', 
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  avatarTextLarge: { color: '#fff', fontSize: 30, fontWeight: 'bold' },
  headerEmail: { marginTop: 10, color: '#666', fontWeight: '500', fontSize: 16 },
  form: { padding: 20 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#FF6F00', marginBottom: 15 },
  label: { fontSize: 12, color: '#999', marginBottom: 5, fontWeight: '600' },
  input: { borderBottomWidth: 1, borderBottomColor: '#EEE', marginBottom: 15, fontSize: 16, paddingVertical: 5, color: '#333' },
  disabledInput: { color: '#AAA', borderBottomColor: '#F9F9F9' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 25 },
  smallBtn: { backgroundColor: '#FF6F00', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 5 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});