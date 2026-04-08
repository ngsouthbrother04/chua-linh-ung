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
import { autoTranslate } from "../utils/translator"; // Đảm bảo import đúng đường dẫn

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
  // --- STATES ---
  const [pois, setPois] = useState([]);
  const [filteredPois, setFilteredPois] = useState([]);
  const [selectedPoi, setSelectedPoi] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLangModalVisible, setIsLangModalVisible] = useState(false);
  
  const [lang, setLang] = useState(LANGUAGES[0]);
  const [translatedData, setTranslatedData] = useState({ name: "", desc: "" });
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [userData, setUserData] = useState({ name: "Người dùng", email: "" });
  const mapRef = useRef(null);

  // --- LOGIC ---

  useEffect(() => {
    fetchPois();
    loadUserData();
    const unsubscribe = navigation.addListener('focus', loadUserData);
    return unsubscribe;
  }, [navigation]);

  // Tự động dịch mỗi khi đổi Địa điểm hoặc đổi Ngôn ngữ
  useEffect(() => {
    if (selectedPoi) handleAutoTranslate();
  }, [selectedPoi, lang]);

  const loadUserData = async () => {
    const name = await AsyncStorage.getItem('userName') || "Khách du lịch";
    const email = await AsyncStorage.getItem('userEmail') || "";
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
    // Lưu ý: Sửa .name?.vi thành .name nếu bạn đã đổi DB sang String
    const originName = selectedPoi.name?.vi || selectedPoi.name || "";
    const originDesc = selectedPoi.description?.vi || selectedPoi.description || "";

    if (lang.code === 'vi') {
      setTranslatedData({ name: originName, desc: originDesc });
      return;
    }

    setIsTranslating(true);
    try {
      const [tName, tDesc] = await Promise.all([
        autoTranslate(originName, lang.code),
        autoTranslate(originDesc, lang.code)
      ]);
      setTranslatedData({ name: tName, desc: tDesc });
    } catch (e) {
      setTranslatedData({ name: originName, desc: originDesc });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleToggleSpeech = async () => {
    if (!translatedData.desc) return;
    const speaking = await Speech.isSpeakingAsync();
    
    if (speaking || isSpeaking) {
      await Speech.stop();
      setIsSpeaking(false);
      return;
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

  const handleLogout = async () => {
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

      {/* SEARCH SECTION */}
      <View style={styles.searchSection}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.roundBtn} onPress={() => setIsMenuVisible(true)}>
            <Text style={{fontSize: 20}}>☰</Text>
          </TouchableOpacity>
          <View style={styles.searchBar}>
            <TextInput
              placeholder={lang.code === 'vi' ? "Tìm kiếm địa điểm..." : "Search locations..."}
              style={styles.input}
              value={searchQuery}
              onChangeText={(t) => {
                setSearchQuery(t);
                const filtered = pois.filter(p => (p.name?.vi || p.name || "").toLowerCase().includes(t.toLowerCase()));
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
                    latitudeDelta: 0.005, longitudeDelta: 0.005,
                  }, 1000);
                }}>
                  <Text style={styles.dropItemText}>{item.name?.vi || item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {/* GOOGLE MAP */}
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

      {/* BOTTOM INFO CARD */}
      <View style={styles.infoContainer}>
        <View style={styles.handle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding: 25}}>
          {isTranslating ? (
            <View style={{height: 100, justifyContent: 'center'}}><ActivityIndicator color="#FF6F00" /></View>
          ) : (
            <>
              <View style={styles.badge}><Text style={styles.badgeText}>{selectedPoi?.type || 'LOCAL FOOD'}</Text></View>
              <Text style={styles.poiName}>{translatedData.name}</Text>
              <View style={styles.divider} />
              <Text style={styles.descLabel}>{lang.code === 'vi' ? "THÔNG TIN CHI TIẾT" : "DETAILS"}</Text>
              <Text style={styles.poiDesc}>{translatedData.desc}</Text>
              
              <TouchableOpacity style={[styles.audioBtn, isSpeaking && styles.audioBtnActive]} onPress={handleToggleSpeech}>
                <Text style={[styles.audioBtnText, isSpeaking && {color: '#fff'}]}>
                  {isSpeaking ? "⏹ STOP SPEAKING" : `🔊 LISTEN (${lang.name.toUpperCase()})`}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>

      {/* SIDE MENU MODAL */}
      <Modal visible={isMenuVisible} animationType="slide" transparent onRequestClose={() => setIsMenuVisible(false)}>
        <View style={styles.menuOverlay}>
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
              <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                <Text style={styles.menuItemIcon}>🚪</Text><Text style={[styles.menuItemText, {color: '#FF3B30'}]}>Đăng xuất</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeMenuBtn} onPress={() => setIsMenuVisible(false)}>
                <Text style={{color: '#666'}}>Đóng menu</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={{flex:1}} onPress={() => setIsMenuVisible(false)} />
        </View>
      </Modal>

      {/* LANGUAGE SELECTION MODAL */}
      <Modal visible={isLangModalVisible} animationType="fade" transparent>
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
                  <Text style={{fontSize: 30}}>{item.flag}</Text>
                  <Text style={styles.langNameText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchSection: { position: 'absolute', top: 50, left: 15, right: 15, zIndex: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', backgroundColor: '#fff', borderRadius: 25, height: 50, alignItems: 'center', paddingHorizontal: 20, marginHorizontal: 10, elevation: 10 },
  input: { flex: 1, fontSize: 14 },
  roundBtn: { width: 50, height: 50, backgroundColor: '#fff', borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 10 },
  dropdown: { backgroundColor: '#fff', borderRadius: 15, marginTop: 10, elevation: 10, maxHeight: 200 },
  dropItem: { padding: 15, borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  dropItemText: { fontWeight: '500' },
  map: { width: width, height: height * 0.65 },
  customMarker: { backgroundColor: '#fff', padding: 5, borderRadius: 20, borderWidth: 2, borderColor: '#FF6F00' },
  activeMarker: { backgroundColor: '#FF6F00' },
  infoContainer: { flex: 1, backgroundColor: "#fff", borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: -30, elevation: 25 },
  handle: { width: 40, height: 5, backgroundColor: '#EEE', borderRadius: 5, alignSelf: 'center', marginTop: 10 },
  badge: { backgroundColor: '#FFF3E0', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginBottom: 5 },
  badgeText: { color: '#FF6F00', fontSize: 10, fontWeight: 'bold' },
  poiName: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 15 },
  descLabel: { fontSize: 10, color: '#999', marginBottom: 5, fontWeight: 'bold' },
  poiDesc: { fontSize: 15, color: '#555', lineHeight: 22, marginBottom: 20 },
  audioBtn: { backgroundColor: '#FFF3E0', padding: 15, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#FF6F00' },
  audioBtnActive: { backgroundColor: '#FF6F00' },
  audioBtnText: { color: '#FF6F00', fontWeight: 'bold' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' },
  menuSideBar: { width: width * 0.75, backgroundColor: '#fff', height: '100%', elevation: 20 },
  menuHeader: { padding: 40, paddingTop: 60, backgroundColor: '#FFF3E0', alignItems: 'center' },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FF6F00', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  avatarText: { color: '#fff', fontSize: 35, fontWeight: 'bold' },
  menuName: { fontSize: 20, fontWeight: 'bold' },
  menuEmail: { color: '#666', fontSize: 12 },
  menuBody: { padding: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  menuItemIcon: { fontSize: 20, marginRight: 15 },
  menuItemText: { fontSize: 16, fontWeight: '500' },
  closeMenuBtn: { marginTop: 30, alignSelf: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 25, padding: 20, width: '85%', maxHeight: '70%' },
  modalTitle: { textAlign: 'center', fontWeight: 'bold', marginBottom: 15, fontSize: 16 },
  langGridItem: { flex: 1, alignItems: 'center', padding: 15, margin: 5, borderRadius: 15, borderWidth: 1, borderColor: '#EEE' },
  langGridItemActive: { backgroundColor: '#FFF3E0', borderColor: '#FF6F00' },
  langNameText: { fontSize: 12, marginTop: 5, fontWeight: '500' }
});