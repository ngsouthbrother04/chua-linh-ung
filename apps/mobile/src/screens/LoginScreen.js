import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useState } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from "../api/api";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

const handleLogin = async () => {
  try {
    const res = await API.post("/auth/login", { email, password });
    
    if (res.data && res.data.accessToken) {
      const token = res.data.accessToken;
      const user = res.data.user; // Kiểm tra log xem server trả về user hay data.user

      await AsyncStorage.setItem('userToken', token);
      
      // LƯU CẨN THẬN Ở ĐÂY
      if (user) {
        await AsyncStorage.setItem('userName', user.fullName || "Người dùng");
        await AsyncStorage.setItem('userEmail', user.email || email);
      }

      navigation.replace("Home");
    }
  } catch (err) {
    Alert.alert("Lỗi", "Đăng nhập thất bại!");
  }
};

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.innerContainer}>
        {/* Header App */}
        <View style={styles.headerContainer}>
          <Text style={styles.logoIcon}>🏙️</Text>
          <Text style={styles.logoText}>PHỐ ẨM THỰC</Text>
          <Text style={styles.subTitle}>Hành trình khám phá đặc sản địa phương</Text>
        </View>

        {/* Input Email */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            placeholder="example@gmail.com"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Input Mật khẩu */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Mật khẩu</Text>
          <TextInput
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
            style={styles.input}
          />
        </View>

        {/* Nút Đăng Nhập */}
        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>Đăng Nhập</Text>
        </TouchableOpacity>

        {/* Footer chuyển sang Đăng ký */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Bạn mới biết đến Phố Ẩm Thực? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Register")}>
            <Text style={styles.signUpText}>Tham gia ngay</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  innerContainer: { flex: 1, justifyContent: "center", paddingHorizontal: 30 },
  headerContainer: { alignItems: "center", marginBottom: 40 },
  logoIcon: { fontSize: 50, marginBottom: 10 },
  logoText: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FF6F00",
    letterSpacing: 1.5,
  },
  subTitle: { fontSize: 13, color: "#9E9E9E", marginTop: 5 },
  inputContainer: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: "bold", color: "#424242", marginBottom: 5 },
  input: {
    backgroundColor: "#FAFAFA",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  loginButton: {
    backgroundColor: "#FF6F00",
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 20,
    elevation: 3,
  },
  loginButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold", textAlign: "center" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  footerText: { color: "#757575", fontSize: 14 },
  signUpText: { color: "#FF6F00", fontSize: 14, fontWeight: "bold" },
});