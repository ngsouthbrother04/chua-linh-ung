import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  Alert, 
  StatusBar,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import API from "../api/api";

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert("Lưu ý", "Vui lòng nhập đầy đủ thông tin!");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Lỗi", "Mật khẩu xác nhận không khớp!");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Lỗi", "Mật khẩu phải có ít nhất 6 ký tự!");
      return;
    }

    setLoading(true);
    try {
      const res = await API.post("/auth/register", {
        email: email.trim(),
        password,
      });

      Alert.alert("Thành công", "Tài khoản Phố Ẩm Thực đã sẵn sàng!", [
        { text: "Đăng nhập ngay", onPress: () => navigation.navigate("Login") }
      ]);
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Đăng ký thất bại, vui lòng thử lại!";
      Alert.alert("Lỗi đăng ký", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.innerContainer}>
            
            {/* Header trang trí tương đồng Login */}
            <View style={styles.headerCard}>
              <View style={styles.logoCircle}>
                <Ionicons name="person-add" size={40} color="#FF6F00" />
              </View>
              <Text style={styles.logoText}>ĐĂNG KÝ</Text>
              <Text style={styles.subTitle}>Khám phá tinh hoa ẩm thực cùng chúng tôi</Text>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.welcomeText}>Tạo tài khoản mới</Text>

              {/* Input Email */}
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

              {/* Input Mật khẩu */}
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
                  <Ionicons 
                    name={showPassword ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    color="#9E9E9E" 
                  />
                </TouchableOpacity>
              </View>

              {/* Input Xác nhận mật khẩu */}
              <View style={styles.inputWrapper}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#FF6F00" style={styles.inputIcon} />
                <TextInput
                  placeholder="Xác nhận mật khẩu"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  style={styles.input}
                />
              </View>

              {/* Nút Đăng ký */}
              <TouchableOpacity 
                style={[styles.registerButton, loading && { opacity: 0.7 }]} 
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.registerButtonText}>TẠO TÀI KHOẢN</Text>
                )}
              </TouchableOpacity>

              {/* Footer */}
              <TouchableOpacity 
                style={styles.footer} 
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.footerText}>
                  Đã có tài khoản? <Text style={styles.signInText}>Đăng nhập</Text>
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F8F9FA" 
  },
  scrollContainer: { 
    flexGrow: 1, 
    justifyContent: "center" 
  },
  innerContainer: { 
    paddingHorizontal: 25, 
    paddingVertical: 30
  },
  headerCard: { 
    alignItems: "center", 
    marginBottom: 30 
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#FF6F00",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    marginBottom: 15
  },
  logoText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    letterSpacing: 2,
  },
  subTitle: { 
    fontSize: 14, 
    color: "#7F8C8D", 
    marginTop: 5,
    textAlign: "center"
  },
  formContainer: {
    backgroundColor: "#FFF",
    borderRadius: 25,
    padding: 25,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2C3E50",
    marginBottom: 20,
    textAlign: "center"
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F2F6",
    borderRadius: 15,
    paddingHorizontal: 15,
    marginBottom: 15,
    height: 55,
    borderWidth: 1,
    borderColor: "#E1E2E6"
  },
  inputIcon: {
    marginRight: 10
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#2C3E50",
  },
  registerButton: {
    backgroundColor: "#FF6F00",
    borderRadius: 15,
    height: 55,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#FF6F00",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    marginTop: 10
  },
  registerButtonText: { 
    color: "#fff", 
    fontSize: 16, 
    fontWeight: "bold", 
    letterSpacing: 1
  },
  footer: { 
    alignItems: "center", 
    marginTop: 25 
  },
  footerText: { 
    color: "#95A5A6", 
    fontSize: 14 
  },
  signInText: { 
    color: "#FF6F00", 
    fontWeight: "bold" 
  },
});