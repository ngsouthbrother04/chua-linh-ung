import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  Alert, 
  ScrollView, 
  TouchableWithoutFeedback, 
  Keyboard,
  StatusBar,
  Modal,
  ActivityIndicator
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from "../api/api";
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen({ navigation }) {
  // --- LOGIN STATE ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- FORGOT PASSWORD STATE ---
  const [isForgotModalVisible, setIsForgotModalVisible] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); 
  const [forgotEmail, setForgotEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  // --- XỬ LÝ ĐĂNG NHẬP ---
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Thông báo", "Vui lòng nhập đầy đủ thông tin!");
      return;
    }
    setLoading(true);
    try {
      const res = await API.post("/auth/login", { email: email.trim(), password });
      if (res.data && res.data.accessToken) {
        await AsyncStorage.setItem('userToken', res.data.accessToken);
        if (res.data.user) {
          await AsyncStorage.setItem('userName', res.data.user.fullName || "Người dùng");
          await AsyncStorage.setItem('userEmail', res.data.user.email || email);
        }
        navigation.replace("Home");
      }
    } catch (err) {
      Alert.alert("Lỗi", "Email hoặc mật khẩu không chính xác!");
    } finally {
      setLoading(false);
    }
  };

  // --- XỬ LÝ QUÊN MẬT KHẨU ---
  const handleRequestOTP = async () => {
    if (!forgotEmail) {
      Alert.alert("Lỗi", "Vui lòng nhập địa chỉ Email!");
      return;
    }
    setForgotLoading(true);
    try {
      await API.post("/auth/forgot-password", { email: forgotEmail.trim().toLowerCase() });
      Alert.alert("Thành công", "Mã xác nhận đã được gửi vào Email của bạn.");
      setForgotStep(2);
    } catch (err) {
      const msg = err.response?.data?.message || "Không tìm thấy tài khoản với email này!";
      Alert.alert("Lỗi", msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!otp || !newPassword) {
      Alert.alert("Lỗi", "Vui lòng nhập mã xác thực và mật khẩu mới!");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Lỗi", "Mật khẩu mới phải từ 6 ký tự trở lên!");
      return;
    }
    setForgotLoading(true);
    try {
      await API.post("/auth/reset-password", { 
        email: forgotEmail.trim().toLowerCase(), 
        otp: otp.trim(), 
        newPassword 
      });
      Alert.alert("Thành công", "Mật khẩu đã được khôi phục. Hãy đăng nhập lại.");
      setIsForgotModalVisible(false);
      setForgotStep(1);
      setForgotEmail(""); setOtp(""); setNewPassword("");
    } catch (err) {
      const msg = err.response?.data?.message || "Mã OTP không đúng hoặc đã hết hạn!";
      Alert.alert("Lỗi", msg);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined} 
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView 
            contentContainerStyle={styles.scrollContainer} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.innerContainer}>
              <View style={styles.headerCard}>
                <View style={styles.logoCircle}><Text style={styles.logoIcon}>🍜</Text></View>
                <Text style={styles.logoText}>PHỐ ẨM THỰC</Text>
                <Text style={styles.subTitle}>Khám phá hương vị Việt qua từng bước chân</Text>
              </View>

              <View style={styles.formContainer}>
                <Text style={styles.welcomeText}>Chào mừng trở lại!</Text>
                
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#FF6F00" style={styles.inputIcon} />
                  <TextInput 
                    placeholder="Địa chỉ Email" 
                    value={email} 
                    onChangeText={setEmail} 
                    style={styles.input} 
                    keyboardType="email-address" 
                    autoCapitalize="none" 
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#FF6F00" style={styles.inputIcon} />
                  <TextInput 
                    placeholder="Mật khẩu" 
                    value={password} 
                    onChangeText={setPassword} 
                    secureTextEntry={!showPassword} 
                    style={styles.input} 
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#9E9E9E" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.forgotPass} onPress={() => setIsForgotModalVisible(true)}>
                  <Text style={styles.forgotPassText}>Quên mật khẩu?</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.loginButton, loading && { opacity: 0.7 }]} 
                  onPress={handleLogin} 
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>ĐĂNG NHẬP</Text>}
                </TouchableOpacity>

                <View style={styles.footer}>
                  <Text style={styles.footerText}>Chưa có tài khoản? </Text>
                  <TouchableOpacity onPress={() => navigation.navigate("Register")}>
                    <Text style={styles.signUpText}>Đăng ký ngay</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* --- MODAL QUÊN MẬT KHẨU --- */}
      <Modal visible={isForgotModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Khôi phục tài khoản</Text>
                <TouchableOpacity onPress={() => { setIsForgotModalVisible(false); setForgotStep(1); }}>
                  <Ionicons name="close-circle" size={28} color="#9E9E9E" />
                </TouchableOpacity>
              </View>

              {forgotStep === 1 ? (
                <View>
                  <Text style={styles.modalSub}>Nhập email đăng ký để nhận mã xác thực OTP qua thư.</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="at-outline" size={20} color="#FF6F00" style={styles.inputIcon} />
                    <TextInput placeholder="Email của bạn" value={forgotEmail} onChangeText={setForgotEmail} style={styles.input} keyboardType="email-address" autoCapitalize="none" />
                  </View>
                  <TouchableOpacity style={styles.loginButton} onPress={handleRequestOTP} disabled={forgotLoading}>
                    {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>GỬI MÃ XÁC NHẬN</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <Text style={styles.modalSub}>Vui lòng kiểm tra Email và nhập mã OTP.</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="keypad-outline" size={20} color="#FF6F00" style={styles.inputIcon} />
                    <TextInput placeholder="Nhập mã OTP" value={otp} onChangeText={setOtp} style={styles.input} keyboardType="number-pad" />
                  </View>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-open-outline" size={20} color="#FF6F00" style={styles.inputIcon} />
                    <TextInput placeholder="Mật khẩu mới" value={newPassword} onChangeText={setNewPassword} style={styles.input} secureTextEntry />
                  </View>
                  <TouchableOpacity style={styles.loginButton} onPress={handleResetPassword} disabled={forgotLoading}>
                    {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>ĐỔI MẬT KHẨU</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={{marginTop: 15}} onPress={() => setForgotStep(1)}>
                    <Text style={{textAlign: 'center', color: '#FF6F00'}}>Quay lại bước nhập Email</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  scrollContainer: { flexGrow: 1, justifyContent: "center", paddingBottom: 20 },
  innerContainer: { paddingHorizontal: 25 },
  headerCard: { alignItems: "center", marginBottom: 30 },
  logoCircle: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: "#FFF",
    justifyContent: "center", alignItems: "center", elevation: 10,
    shadowColor: "#FF6F00", shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2, shadowRadius: 10, marginBottom: 20
  },
  logoIcon: { fontSize: 50 },
  logoText: { fontSize: 32, fontWeight: "bold", color: "#333", letterSpacing: 2 },
  subTitle: { fontSize: 14, color: "#7F8C8D", marginTop: 8, textAlign: "center", lineHeight: 20 },
  formContainer: { backgroundColor: "#FFF", borderRadius: 25, padding: 25, elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  welcomeText: { fontSize: 22, fontWeight: "bold", color: "#2C3E50", marginBottom: 25, textAlign: "center" },
  inputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F2F6", borderRadius: 15, paddingHorizontal: 15, marginBottom: 15, height: 55, borderWidth: 1, borderColor: "#E1E2E6" },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: "#2C3E50" },
  forgotPass: { alignSelf: "flex-end", marginBottom: 25 },
  forgotPassText: { color: "#7F8C8D", fontSize: 13 },
  loginButton: { backgroundColor: "#FF6F00", borderRadius: 15, height: 55, justifyContent: "center", alignItems: "center", elevation: 5, shadowColor: "#FF6F00", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  loginButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold", letterSpacing: 1 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 25 },
  footerText: { color: "#95A5A6", fontSize: 14 },
  signUpText: { color: "#FF6F00", fontSize: 14, fontWeight: "bold" },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 25, padding: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#2C3E50' },
  modalSub: { fontSize: 14, color: '#7F8C8D', marginBottom: 20, textAlign: 'center' }
});