import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "../screens/LoginScreen";
import HomeScreen from "../screens/HomeScreen";
import RegisterScreen from "../screens/RegisterScreen";
import ProfileScreen from "../screens/ProfileScreen";
const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login" // Đảm bảo luôn bắt đầu từ Login
        screenOptions={{
          headerShown: true,
          headerStyle: {
            backgroundColor: "#fff", // Màu nền thanh tiêu đề
          },
          headerTintColor: "#E64A19", // Màu nút Back và Tiêu đề
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      >
        {/* 1. Màn hình Login: Ẩn header */}
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
          options={{ headerShown: false }} 
        />

        {/* 2. Màn hình Register: Hiện tiêu đề để người dùng có nút quay lại */}
        <Stack.Screen 
          name="Register" 
          component={RegisterScreen} 
          options={{ title: "Tạo tài khoản mới" }} 
        />

        {/* 3. Màn hình Home: Màn hình chính sau khi đăng nhập */}
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ 
            title: "🏠 Trang chủ",
            headerStyle: {
              backgroundColor: "#fff",
              height: 50, 
            },
          }} 
        />
        {/* 4.Màn hình Profile: Cho phép người dùng xem và chỉnh sửa thông tin cá nhân */}
        <Stack.Screen 
          name="Profile" 
          component={ProfileScreen} 
          options={{ title: "👤 Thông tin cá nhân" }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}