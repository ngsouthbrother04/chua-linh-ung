import React, { useState, useEffect, useRef } from "react";
import { 
  View, Text, StyleSheet, Dimensions, TextInput, 
  ScrollView, TouchableOpacity, FlatList, ActivityIndicator, Modal, Alert, StatusBar 
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { CommonActions } from '@react-navigation/native';
import API from "../api/api";

const { width, height } = Dimensions.get("window");

const LANGUAGES = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳', locale: 'vi-VN' },
  { code: 'en', name: 'English', flag: '🇺🇸', locale: 'en-US' },
  { code: 'th', name: 'ภาษาไทย', flag: '🇹🇭', locale: 'th-TH' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', locale: 'ja-JP' },
  { code: 'ko', name: '한국어', flag: '🇰🇷', locale: 'ko-KR' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', locale: 'fr-FR' },
];

export default function HomeScreen({ navigation }) {
  // --- TẤT CẢ HOOKS PHẢI NẰM TRONG NÀY ---
  
  // States dữ liệu POI
  const [pois, setPois] = useState([]);
  const [filteredPois, setFilteredPois] = useState([]);
  const [selectedPoi, setSelectedPoi] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // States UI & Modals
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLangModalVisible, setIsLangModalVisible] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  
  // States Dịch & Thuyết minh
  const [lang, setLang] = useState(LANGUAGES[0]);
  const [translatedData, setTranslatedData] = useState({ name: "", desc: "" });
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // States User & Mật khẩu
  const [userData, setUserData] = useState({ name: "Người dùng", email: "guest@sgu.edu.vn" });
  const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });

  const mapRef = useRef(null);

  // --- LOGIC FUNCTIONS ---

  useEffect(() => {
    fetchPois();
    loadUserData();
    
    // Cập nhật lại tên khi quay về từ ProfileScreen
    const unsubscribe = navigation.addListener('focus', () => {
      loadUserData();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (selectedPoi) handleAutoTranslate();
  }, [selectedPoi, lang]);

  const loadUserData = async () => {
    const name = await AsyncStorage.getItem('userName') || "Khách du lịch";
    const email = await AsyncStorage.getItem('userEmail') || "user@student.sgu.edu.vn";
    setUserData({ name, email });
  };

  const fetchPois = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const res = await API.get("/pois", { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.data?.items) {
        const items = res.data.data.items;
        setPois(items);
        setFilteredPois(items);
        if (items.length > 0) setSelectedPoi(items[0]);
      }
    } catch (err) {
      console.log("Lỗi tải POI:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoTranslate = async () => {
    const originName = selectedPoi.name?.vi || "";
    const originDesc = selectedPoi.description?.vi || "";
    if (lang.code === 'vi') {
      setTranslatedData({ name: originName, desc: originDesc });
      return;
    }
    try {
      setIsTranslating(true);
      const fetchT = async (text) => {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${lang.code}&dt=t&q=${encodeURI(text)}`;
        const res = await fetch(url);
        const json = await res.json();
        return json[0].map(item => item[0]).join("");
      };
      const [tName, tDesc] = await Promise.all([fetchT(originName), fetchT(originDesc)]);
      setTranslatedData({ name: tName, desc: tDesc });
    } catch (e) {
      setTranslatedData({ name: originName, desc: originDesc });
    } finally { setIsTranslating(false); }
  };

  const handleToggleSpeech = async () => {
    if (!translatedData.desc) return;
    const speaking = await Speech.isSpeakingAsync();
    if (speaking || isSpeaking) {
      await Speech.stop();
      setIsSpeaking(false);
      if (speaking) return;
    }
    setIsSpeaking(true);
    Speech.speak(translatedData.desc, {
      language: lang.locale,
      rate: 0.9,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };


  const handleLogout = () => {
    setIsMenuVisible(false);
    Alert.alert("Đăng xuất", "Bạn có chắc chắn muốn thoát?", [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng xuất", onPress: async () => {
        await Speech.stop();
        await AsyncStorage.clear();
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
      }}
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#FF6F00" /></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER & SEARCH */}
      <View style={styles.searchSection}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.roundBtn} onPress={() => setIsMenuVisible(true)}>
            <Text style={{fontSize: 20}}>☰</Text>
          </TouchableOpacity>
          <View style={styles.searchBar}>
            <TextInput
              placeholder={lang.code === 'vi' ? "Khám phá ẩm thực..." : "Explore food..."}
              style={styles.input}
              value={searchQuery}
              onChangeText={(t) => {
                setSearchQuery(t);
                const filtered = pois.filter(p => (p.name?.vi || "").toLowerCase().includes(t.toLowerCase()));
                setFilteredPois(filtered);
                setIsDropdownVisible(t.length > 0);
              }}
            />
          </View>
          <TouchableOpacity style={styles.roundBtn} onPress={() => setIsLangModalVisible(true)}>
            <Text style={{fontSize: 22}}>{lang.flag}</Text>
          </TouchableOpacity>
        </View>

        {isDropdownVisible && (
          <View style={styles.dropdown}>
            <FlatList
              data={filteredPois}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.dropItem} onPress={() => {
                  setSelectedPoi(item);
                  setIsDropdownVisible(false);
                  setSearchQuery("");
                  mapRef.current?.animateToRegion({
                    latitude: item.latitude, longitude: item.longitude,
                    latitudeDelta: 0.01, longitudeDelta: 0.01,
                  }, 1000);
                }}>
                  <Text style={styles.dropItemText}>{item.name?.vi}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {/* MAP */}
      <MapView 
        ref={mapRef} 
        style={styles.map} 
        provider={PROVIDER_GOOGLE}
        initialRegion={{ latitude: 10.7712, longitude: 106.6901, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        {pois.map((p) => (
          <Marker key={p.id} coordinate={{ latitude: p.latitude, longitude: p.longitude }} onPress={() => setSelectedPoi(p)}>
            <View style={[styles.customMarker, selectedPoi?.id === p.id && styles.activeMarker]}>
              <Text style={{fontSize: 14}}>📍</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* INFO CARD */}
      <View style={styles.infoContainer}>
        <View style={styles.handle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding: 25}}>
          {isTranslating ? (
            <ActivityIndicator color="#FF6F00" />
          ) : (
            <>
              <View style={styles.badge}><Text style={styles.badgeText}>{selectedPoi?.type || 'FOOD'}</Text></View>
              <Text style={styles.poiName}>{translatedData.name}</Text>
              <View style={styles.divider} />
              <Text style={styles.descLabel}>{lang.code === 'vi' ? "THÔNG TIN CHI TIẾT" : "DETAILS"}</Text>
              <Text style={styles.poiDesc}>{translatedData.desc}</Text>
              <TouchableOpacity style={[styles.audioBtn, isSpeaking && styles.audioBtnActive]} onPress={handleToggleSpeech}>
                <Text style={[styles.audioBtnText, isSpeaking && {color: '#fff'}]}>
                  {isSpeaking ? "⏹ DỪNG THUYẾT MINH" : `🔊 NGHE (${lang.name.toUpperCase()})`}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>

      {/* MODAL SIDE MENU */}
      <Modal visible={isMenuVisible} animationType="fade" transparent onRequestClose={() => setIsMenuVisible(false)}>
        <View style={styles.menuOverlay}>
          <TouchableOpacity style={{flex:1}} onPress={() => setIsMenuVisible(false)} />
          <View style={styles.menuSideBar}>
            <View style={styles.menuHeader}>
              <View style={styles.avatarCircle}><Text style={styles.avatarText}>{userData.name.charAt(0)}</Text></View>
              <Text style={styles.menuName}>{userData.name}</Text>
              <Text style={styles.menuEmail}>{userData.email}</Text>
            </View>
            <View style={styles.menuBody}>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuVisible(false); navigation.navigate('Profile'); }}>
                <Text style={styles.menuItemIcon}>👤</Text><Text style={styles.menuItemText}>Hồ sơ cá nhân</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                <Text style={styles.menuItemIcon}>🚪</Text><Text style={[styles.menuItemText, {color: '#FF3B30'}]}>Đăng xuất</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL ĐỔI MẬT KHẨU */}
      <Modal visible={isPasswordModalVisible} animationType="fade" transparent onRequestClose={() => setIsPasswordModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Đổi mật khẩu</Text>
            <TextInput style={styles.modalInput} placeholder="Mật khẩu cũ" secureTextEntry onChangeText={(t) => setPasswords({...passwords, old: t})} />
            <TextInput style={styles.modalInput} placeholder="Mật khẩu mới" secureTextEntry onChangeText={(t) => setPasswords({...passwords, new: t})} />
            <TextInput style={styles.modalInput} placeholder="Xác nhận mật khẩu mới" secureTextEntry onChangeText={(t) => setPasswords({...passwords, confirm: t})} />
            <TouchableOpacity style={{marginTop: 15}} onPress={() => setIsPasswordModalVisible(false)}>
              <Text style={{color: '#999', textAlign: 'center'}}>Hủy bỏ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL LANGUAGE */}
      <Modal visible={isLangModalVisible} animationType="fade" transparent onRequestClose={() => setIsLangModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Chọn Ngôn Ngữ / Language</Text>
            <FlatList
              data={LANGUAGES}
              numColumns={2}
              keyExtractor={(i) => i.code}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.langGridItem, lang.code === item.code && styles.langGridItemActive]} 
                  onPress={() => { setLang(item); setIsLangModalVisible(false); Speech.stop(); }}
                >
                  <Text style={{fontSize: 35}}>{item.flag}</Text>
                  <Text style={styles.langNameText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.closeBtn} onPress={() => setIsLangModalVisible(false)}>
              <Text style={{color: '#fff', fontWeight: 'bold'}}>ĐÓNG</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchSection: { position: 'absolute', top: 50, left: 15, right: 15, zIndex: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  searchBar: { 
    flex: 1, flexDirection: 'row', backgroundColor: '#fff', borderRadius: 20, 
    height: 50, alignItems: 'center', paddingHorizontal: 15, marginHorizontal: 10,
    elevation: 8, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10
  },
  input: { flex: 1, fontSize: 14 },
  roundBtn: { width: 50, height: 50, backgroundColor: '#fff', borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  dropdown: { backgroundColor: '#fff', borderRadius: 15, marginTop: 10, elevation: 5, maxHeight: 180 },
  dropItem: { padding: 15, borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  dropItemText: { fontWeight: '500', color: '#333' },
  map: { width: width, height: height * 0.6 },
  customMarker: { backgroundColor: '#fff', padding: 6, borderRadius: 20, borderWidth: 2, borderColor: '#FF6F00', elevation: 5 },
  activeMarker: { backgroundColor: '#FF6F00', borderColor: '#fff' },
  infoContainer: { flex: 1, backgroundColor: "#fff", borderTopLeftRadius: 35, borderTopRightRadius: 35, marginTop: -40, elevation: 20 },
  handle: { width: 40, height: 5, backgroundColor: '#E0E0E0', borderRadius: 5, alignSelf: 'center', marginTop: 12 },
  badge: { backgroundColor: '#FFF3E0', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, marginBottom: 8 },
  badgeText: { color: '#FF6F00', fontSize: 10, fontWeight: 'bold' },
  poiName: { fontSize: 24, fontWeight: '800', color: '#1A1A1A' },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginVertical: 15 },
  descLabel: { fontSize: 11, fontWeight: 'bold', color: '#999', marginBottom: 5, letterSpacing: 1 },
  poiDesc: { fontSize: 16, color: '#444', lineHeight: 24, marginBottom: 25 },
  audioBtn: { backgroundColor: '#FFF3E0', padding: 18, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#FF6F00' },
  audioBtnActive: { backgroundColor: '#FF6F00' },
  audioBtnText: { color: '#FF6F00', fontWeight: 'bold' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' },
  menuSideBar: { width: width * 0.75, backgroundColor: '#fff', height: '100%', paddingTop: 60 },
  menuHeader: { padding: 25, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', alignItems: 'center' },
  avatarCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FF6F00', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: 'bold' },
  menuName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  menuEmail: { fontSize: 12, color: '#999' },
  menuBody: { padding: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  menuItemIcon: { fontSize: 20, marginRight: 15, width: 30 },
  menuItemText: { fontSize: 16, fontWeight: '500', color: '#444' },
  menuDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 10 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 30, padding: 20, width: '90%' },
  modalTitle: { textAlign: 'center', fontWeight: 'bold', marginBottom: 20, fontSize: 18, color: '#333' },
  langGridItem: { flex: 1, alignItems: 'center', padding: 15, margin: 5, borderRadius: 20, borderWidth: 1, borderColor: '#EEE' },
  langGridItemActive: { backgroundColor: '#FFF3E0', borderColor: '#FF6F00' },
  langNameText: { fontSize: 12, fontWeight: '600', marginTop: 5 },
  closeBtn: { backgroundColor: '#333', padding: 15, borderRadius: 20, alignItems: 'center', marginTop: 15 },
  modalInput: { backgroundColor: '#F5F5F5', borderRadius: 12, padding: 15, marginBottom: 15, fontSize: 14 },
  confirmBtn: { backgroundColor: '#FF6F00', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 }
});