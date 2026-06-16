import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

export type Language = 'en' | 'bn' | 'pl' | 'tr' | 'so' | 'cy' | 'gd';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.marketplace': 'Marketplace',
    'nav.services': 'Services',
    'nav.rides': 'Rides',
    'nav.profile': 'Profile',

    // Shared / Headers
    'welcome': 'Welcome',
    'welcome.back': 'Welcome Back!',
    'actions.book': 'Book',
    'actions.book.now': 'Book Now',
    'actions.send': 'Send',
    'actions.cancel': 'Cancel',
    'actions.delete': 'Delete',
    'actions.save': 'Save Changes',
    'actions.search': 'Search...',
    'actions.chat': 'Chat',
    'actions.close': 'Close',

    // Home View
    'home.board': 'Neighbourhood Board',
    'home.board.sub': 'Connect, ask questions and coordinate with local residents',
    'home.notifications': 'Recent Notifications',
    'home.analytics': 'Live Metrics & Spending',
    'home.budget': 'Monthly Expense Budget',
    'home.total.spent': 'Total Spent',
    'home.budget.limit': 'Budget Limit',
    'home.budget.remaining': 'Remaining',
    'home.budget.update': 'Update Budget Target',
    'home.active.allocations': 'Active Service Allocations',
    'home.engagement': 'Active Engagement Hours',

    // Services View
    'services.title': 'Community Trades & Services',
    'services.subtitle': 'Verified local specialists ready to help around the neighbourhood',
    'services.request': 'Request Service Support',
    'services.category': 'Category',
    'services.description': 'Describe your issue/needs',
    'services.price': 'Suggested Compensation (£)',
    'services.address': 'Service Address',
    'services.submit': 'Submit Request',
    'services.active': 'Active Request Trackers',

    // Rides view
    'rides.title': 'Local Cab & Rideshare',
    'rides.subtitle': 'Reliable, low-cost community-driven transport for residents',
    'rides.pickup': 'Pickup Point / Address',
    'rides.dropoff': 'Destination / Dropoff Point',
    'rides.price': 'Suggested Offer',
    'rides.submit': 'Request Community Driver',
    'rides.driver': 'Driver Location & Route Map',

    // Profile View
    'profile.title': 'Profile & Customization Settings',
    'profile.subtitle': 'Manage your personal preferences, accessibility, and community profile',
    'profile.worker.mode': 'Worker Dashboard Mode',
    'profile.worker.desc': 'Toggle to switch between looking for services and offering your skills',
    'profile.accessibility': 'Accessibility Adapters',
    'profile.font.scale': 'Font Scale Size',
    'profile.font.normal': 'Normal (100%)',
    'profile.font.large': 'Large (115%)',
    'profile.font.xlarge': 'Extra Large (130%)',
    'profile.contrast': 'High Contrast Focus',
    'profile.theme': 'Dark Visual Theme',
    'profile.lang': 'Interface Language Selection',
    'profile.logout': 'Sign Out of Account',

    // Marketplace View
    'market.title': 'Local Community Marketplace',
    'market.subtitle': 'Buy, sell or claim free goods from your trusted neighbours',
    'market.add': 'List an Item for Sale',
    'market.empty': 'No items currently listed',
    'market.free': 'FREE',
    'market.condition': 'Condition',
    'market.contact': 'Contact Seller',

    // Reviews / Credentials
    'reviews.title': 'Verified Trust Reviews',
    'reviews.rating': 'Community Rating',
    'reviews.no.reviews': 'No verified testimonials listed yet.',
    'reviews.add': 'Share a Verified Review',
    'reviews.write': 'Write custom comments...',
    'reviews.stars': 'Select Star Rating',
    'reviews.add.btn': 'Post Review'
  },
  bn: {
    // Navigation
    'nav.home': 'হোম',
    'nav.marketplace': 'মার্কেটপ্লেস',
    'nav.services': 'সেবাসমূহ',
    'nav.rides': 'রাইডস',
    'nav.profile': 'প্রোফাইল',

    // Shared / Headers
    'welcome': 'স্বাগতম',
    'welcome.back': 'আবার স্বাগতম!',
    'actions.book': 'বুক করুন',
    'actions.book.now': 'এখনই বুক করুন',
    'actions.send': 'পাঠান',
    'actions.cancel': 'বাতিল করুন',
    'actions.delete': 'মুছুন',
    'actions.save': 'পরিবর্তন সংরক্ষণ করুন',
    'actions.search': 'খুঁজুন...',
    'actions.chat': 'চ্যাট',
    'actions.close': 'বন্ধ করুন',

    // Home View
    'home.board': 'প্রতিবেশী বোর্ড',
    'home.board.sub': 'স্থায়ী বাসিন্দাদের সাথে সংযুক্ত থাকুন এবং সমন্বয় করুন',
    'home.notifications': 'সাম্প্রতিক বিজ্ঞপ্তি',
    'home.analytics': 'লাইভ মেট্রিক্স এবং ব্যয়',
    'home.budget': 'মাসিক খরচ বাজেট',
    'home.total.spent': 'মোট খরচ',
    'home.budget.limit': 'বাজেট সীমা',
    'home.budget.remaining': 'অবশিষ্ট',
    'home.budget.update': 'বাজেট টার্গেট আপডেট করুন',
    'home.active.allocations': 'সক্রিয় সেবা বরাদ্দ',
    'home.engagement': 'সক্রিয় অংশগ্রহণের সময়',

    // Services View
    'services.title': 'কমিউনিটি পেশা ও সেবাসমূহ',
    'services.subtitle': 'আপনার আশেপাশে সাহায্য করতে প্রস্তুত যাচাইকৃত স্থানীয় বিশেষজ্ঞ',
    'services.request': 'পরিষেবা সহায়তা অনুরোধ',
    'services.category': 'বিভাগ',
    'services.description': 'আপনার সমস্যা বা প্রয়োজন বর্ণনা করুন',
    'services.price': 'প্রস্তাবিত অর্থ (£)',
    'services.address': 'পরিষেবার ঠিকানা',
    'services.submit': 'অনুরোধ জমা দিন',
    'services.active': 'সক্রিয় অনুরোধ ট্র্যাকার',

    // Rides view
    'rides.title': 'স্থানীয় ক্যাব এবং রাইডশেয়ার',
    'rides.subtitle': 'বাসিন্দাদের জন্য নির্ভরযোগ্য, কম খরচের কমিউনিটি-চালিত পরিবহন',
    'rides.pickup': 'পিকআপ স্থান / ঠিকানা',
    'rides.dropoff': 'গন্তব্য / ড্রপঅফ স্থান',
    'rides.price': 'প্রস্তাবিত অফার',
    'rides.submit': 'কমিউনিটি চালকের অনুরোধ করুন',
    'rides.driver': 'চালকের অবস্থান ও রুট ম্যাপ',

    // Profile View
    'profile.title': 'প্রোফাইল এবং কাস্টমাইজেশন সেটআপ',
    'profile.subtitle': 'আপনার ব্যক্তিগত পছন্দ, অ্যাক্সেসিবিলিটি এবং প্রোফাইল পরিচালনা করুন',
    'profile.worker.mode': 'কর্মী ড্যাশবোর্ড মোড',
    'profile.worker.desc': 'সেবা খুঁজতে এবং আপনার দক্ষতা শেয়ার করতে টগল করুন',
    'profile.accessibility': 'সহজ প্রবেশযোগ্যতা অ্যাডাপ্টার',
    'profile.font.scale': 'ফন্ট সাইজের স্কেল',
    'profile.font.normal': 'সাধারণ (১০০%)',
    'profile.font.large': 'বড় (১১৫%)',
    'profile.font.xlarge': 'অতিরিক্ত বড় (১৩০%)',
    'profile.contrast': 'উচ্চ কনট্রাস্ট ফোকাস',
    'profile.theme': 'ডার্ক মোড থিম',
    'profile.lang': 'ভাষা নির্বাচন করুন',
    'profile.logout': 'অ্যাকাউন্ট থেকে লগ আউট',

    // Marketplace View
    'market.title': 'স্থানীয় কমিউনিটি মার্কেটপ্লেস',
    'market.subtitle': 'আপনার বিশ্বস্ত প্রতিবেশীদের কাছ থেকে কিনুন, বিক্রি করুন বা বিনামূল্যে পণ্য দাবি করুন',
    'market.add': 'বিক্রির জন্য জিনিস তালিকাভুক্ত করুন',
    'market.empty': 'বর্তমানে তালিকায় কোনো জিনিস নেই',
    'market.free': 'ফ্রি',
    'market.condition': 'অবস্থা',
    'market.contact': 'বিক্রেতার সাথে যোগাযোগ করুন',

    // Reviews / Credentials
    'reviews.title': 'যাচাইকৃত বিশ্বস্ত রিভিউ',
    'reviews.rating': 'কমিউনিটি রেটিং',
    'reviews.no.reviews': 'এখনও কোনো যাচাইকৃত প্রশংসাপত্র নেই।',
    'reviews.add': 'যাচাইকৃত মতামত দিন',
    'reviews.write': 'আপনার মন্তব্য লিখুন...',
    'reviews.stars': 'স্টার রেটিং দিন',
    'reviews.add.btn': 'রিভিউ পোস্ট করুন'
  },
  pl: {
    // Navigation
    'nav.home': 'Główna',
    'nav.marketplace': 'Giełda',
    'nav.services': 'Usługi',
    'nav.rides': 'Przejazdy',
    'nav.profile': 'Profil',

    // Shared / Headers
    'welcome': 'Witaj',
    'welcome.back': 'Witaj z powrotem!',
    'actions.book': 'Rezerwuj',
    'actions.book.now': 'Rezerwuj teraz',
    'actions.send': 'Wyślij',
    'actions.cancel': 'Anuluj',
    'actions.delete': 'Usuń',
    'actions.save': 'Zapisz zmiany',
    'actions.search': 'Szukaj...',
    'actions.chat': 'Czat',
    'actions.close': 'Zamknij',

    // Home View
    'home.board': 'Tablica Sąsiedzka',
    'home.board.sub': 'Łącz się, zadawaj pytania i koordynuj z lokalnymi mieszkańcami',
    'home.notifications': 'Ostatnie Powiadomienia',
    'home.analytics': 'Statystyki i Wydatki na Żywo',
    'home.budget': 'Miesięczny Budżet Wydatków',
    'home.total.spent': 'Suma Wydatków',
    'home.budget.limit': 'Limit Budżetu',
    'home.budget.remaining': 'Pozostało',
    'home.budget.update': 'Zaktualizuj Limit Budżetu',
    'home.active.allocations': 'Aktywne Rezerwacje Usług',
    'home.engagement': 'Tygodniowy Czas Aktywności',

    // Services View
    'services.title': 'Sąsiedzkie Usługi i Specjaliści',
    'services.subtitle': 'Zweryfikowani lokalni fachowcy gotowi do pomocy w sąsiedztwie',
    'services.request': 'Zgłoś Zapytanie o Usługę',
    'services.category': 'Kategoria',
    'services.description': 'Opisz swój problem/potrzebę',
    'services.price': 'Sugerowane Wynagrodzenie (£)',
    'services.address': 'Adres Usługi',
    'services.submit': 'Wyślij Zgłoszenie',
    'services.active': 'Aktywne Śledzenie Zgłoszeń',

    // Rides view
    'rides.title': 'Lokalne Taksówki i Podwózki',
    'rides.subtitle': 'Niezawodny, tani transport sąsiedzki dla mieszkańców',
    'rides.pickup': 'Miejsce odbioru / Adres',
    'rides.dropoff': 'Cel podróży / Miejsce docelowe',
    'rides.price': 'Sugerowana stawka',
    'rides.submit': 'Zamów Przejazd Sąsiedzki',
    'rides.driver': 'Lokalizacja Kierowcy i Trasa',

    // Profile View
    'profile.title': 'Ustawienia Profilu i Dostosowania',
    'profile.subtitle': 'Zarządzaj swoimi preferencjami, dostępnością i profilem w społeczności',
    'profile.worker.mode': 'Tryb Dashboardu Pracownika',
    'profile.worker.desc': 'Przełącz, aby oferować swoje umiejętności zamiast szukać pomocy',
    'profile.accessibility': 'Ułatwienia Dostępu',
    'profile.font.scale': 'Rozmiar Czcionki',
    'profile.font.normal': 'Normalna (100%)',
    'profile.font.large': 'Duża (115%)',
    'profile.font.xlarge': 'Bardzo Duża (130%)',
    'profile.contrast': 'Wysoki Kontrast',
    'profile.theme': 'Ciemny Motyw Wizualny',
    'profile.lang': 'Wybór Języka Interfejsu',
    'profile.logout': 'Wyloguj się z konta',

    // Marketplace View
    'market.title': 'Sąsiedzki Rynek Lokalny',
    'market.subtitle': 'Kupuj, sprzedawaj lub odbieraj darmowe rzeczy od zaufanych sąsiadów',
    'market.add': 'Dodaj Przedmiot na Sprzedaż',
    'market.empty': 'Brak przedmiotów na giełdzie',
    'market.free': 'DARMOWE',
    'market.condition': 'Stan',
    'market.contact': 'Kontakt ze Sprzedawcą',

    // Reviews / Credentials
    'reviews.title': 'Zweryfikowane Opinie Zaufania',
    'reviews.rating': 'Ocena Społeczności',
    'reviews.no.reviews': 'Brak zweryfikowanych referencji.',
    'reviews.add': 'Dodaj Zweryfikowaną Opinię',
    'reviews.write': 'Napisz komentarz...',
    'reviews.stars': 'Wybierz Ilość Gwiazdek',
    'reviews.add.btn': 'Opublikuj Opinię'
  },
  tr: {
    // Navigation
    'nav.home': 'Ana Sayfa',
    'nav.marketplace': 'Pazar Yeri',
    'nav.services': 'Hizmetler',
    'nav.rides': 'Araçlar',
    'nav.profile': 'Profil',

    // Shared / Headers
    'welcome': 'Hoş Geldiniz',
    'welcome.back': 'Tekrar Hoş Geldiniz!',
    'actions.book': 'Rezervasyon Yap',
    'actions.book.now': 'Şimdi Rezervasyon Yap',
    'actions.send': 'Gönder',
    'actions.cancel': 'İptal Et',
    'actions.delete': 'Sil',
    'actions.save': 'Değişiklikleri Kaydet',
    'actions.search': 'Ara...',
    'actions.chat': 'Sohbet',
    'actions.close': 'Kapat',

    // Home View
    'home.board': 'Mahalle İlan Panosu',
    'home.board.sub': 'Yerel komşularınızla iletişim kurun, sorular sorun ve organize olun',
    'home.notifications': 'Son Bildirimler',
    'home.analytics': 'Canlı Analizler ve Harcamalar',
    'home.budget': 'Aylık Gider Bütçesi',
    'home.total.spent': 'Toplam Harcanan',
    'home.budget.limit': 'Bütçe Sınırı',
    'home.budget.remaining': 'Kalan',
    'home.budget.update': 'Bütçe Hedefini Güncelle',
    'home.active.allocations': 'Aktif Hizmet Talepleri',
    'home.engagement': 'Haftalık Aktiflik Süresi',

    // Services View
    'services.title': 'Mahalle Hizmetleri ve Ustaları',
    'services.subtitle': 'Yardım etmeye hazır, onaylı yerel uzmanlar komşunuzda',
    'services.request': 'Hizmet Desteği Talep Et',
    'services.category': 'Kategori',
    'services.description': 'Sorununuzu/ihtiyacınızı açıklayın',
    'services.price': 'Önerilen Ücret (£)',
    'services.address': 'Hizmet Adresi',
    'services.submit': 'Talebi Gönder',
    'services.active': 'Aktif Talep Takipçileri',

    // Rides view
    'rides.title': 'Yerel Taksi ve Araç Paylaşımı',
    'rides.subtitle': 'Sakinler için güvenilir, düşük maliyetli topluluk odaklı ulaşım',
    'rides.pickup': 'Alış Noktası / Adres',
    'rides.dropoff': 'Varış Noktası / Adres',
    'rides.price': 'Önerilen Fiyat',
    'rides.submit': 'Sürücü Talep Et',
    'rides.driver': 'Sürücü Konumu ve Güzergah Haritası',

    // Profile View
    'profile.title': 'Profil ve Kişiselleştirme Ayarları',
    'profile.subtitle': 'Kişisel tercihleri, erişilebilirliği ve topluluk profilinizi yönetin',
    'profile.worker.mode': 'Çalışan Paneli Modu',
    'profile.worker.desc': 'Yardım aramak yerine becerilerinizi sunmak için geçiş yapın',
    'profile.accessibility': 'Erişilebilirlik Yardımcıları',
    'profile.font.scale': 'Yazı Boyutu Ölçeği',
    'profile.font.normal': 'Normal (100%)',
    'profile.font.large': 'Büyük (115%)',
    'profile.font.xlarge': 'Çok Büyük (130%)',
    'profile.contrast': 'Yüksek Kontrast',
    'profile.theme': 'Karanlık Görsel Tema',
    'profile.lang': 'Arayüz Dil Seçimi',
    'profile.logout': 'Hesaptan Çıkış Yap',

    // Marketplace View
    'market.title': 'Yerel Topluluk Pazar Yeri',
    'market.subtitle': 'Güvenilir komşularınızdan satın alın, satın veya ücretsiz ürün alın',
    'market.add': 'Satılık Ürün Ekle',
    'market.empty': 'Satışta ürün bulunmuyor',
    'market.free': 'ÜCRETSİZ',
    'market.condition': 'Durum',
    'market.contact': 'Satıcıyla İletişime Geç',

    // Reviews / Credentials
    'reviews.title': 'Onaylı Güven Yorumları',
    'reviews.rating': 'Topluluk Puanı',
    'reviews.no.reviews': 'Henüz onaylı değerlendirme bulunmuyor.',
    'reviews.add': 'Onaylı Yorum Ekle',
    'reviews.write': 'Yorumlarınızı yazın...',
    'reviews.stars': 'Yıldız Sayısı Seçin',
    'reviews.add.btn': 'Yorum Gönder'
  },
  so: {
    // Navigation
    'nav.home': 'Hoyga',
    'nav.marketplace': 'Suuqyada',
    'nav.services': 'Adeegyada',
    'nav.rides': 'Gaadiidka',
    'nav.profile': 'Muuqaalka',

    // Shared / Headers
    'welcome': 'Ksoo Dhawaada',
    'welcome.back': 'Ksoo Dhawaada Markale!',
    'actions.book': 'Boos qabso',
    'actions.book.now': 'Hada Qabso',
    'actions.send': 'Dir',
    'actions.cancel': 'Jooji',
    'actions.delete': 'Tirtir',
    'actions.save': 'Badbaadi Isbedelada',
    'actions.search': 'Raadi...',
    'actions.chat': 'Wada sheekaysi',
    'actions.close': 'Xir',

    // Home View
    'home.board': 'Golaha Xaafada',
    'home.board.sub': 'La xiriir, weydii su\'aalo oo isku dubarido dadka xaafada',
    'home.notifications': 'Ogeysiisyadii Ugu Dambeeyay',
    'home.analytics': 'Xogta Tooska ah & Kharashka',
    'home.budget': 'Miisaaniyadda Bisha ee Kharashka',
    'home.total.spent': 'Wixii Baxay',
    'home.budget.limit': 'Miisaaniyadda',
    'home.budget.remaining': 'Inta Hartay',
    'home.budget.update': 'Cusbooneysii Miisaaniyadda',
    'home.active.allocations': 'Dalabaadka Adeeg ee Tooska ah',
    'home.engagement': 'Saacadaha Dhaqdhaqaaqa Toddobaadlaha ah',

    // Services View
    'services.title': 'Adeegyada & Farsamayaqaannada Xaafadda',
    'services.subtitle': 'Khubaro maxalli ah oo la xaqiijiyay una diyaar ah inay ku caawiyaan',
    'services.request': 'Codso Caawinaad Adeeg',
    'services.category': 'Qaybta',
    'services.description': 'Sharax dhibaatadaada/baahiyahaaga',
    'services.price': 'Lacag bixinta la soo jeediyay (£)',
    'services.address': 'Cinwaanka Adeegga',
    'services.submit': 'Gis Codsiga',
    'services.active': 'Dabagalka Codsiyada Tooska ah',

    // Rides view
    'rides.title': 'Taksiyada Deegaanka & Gaadiid wadaaga',
    'rides.subtitle': 'Gaadiid la isku halleyn karo, qiimo jaban oo ay wadaan dadka xaafadda',
    'rides.pickup': 'Cinwaanka lagugu qaadayo',
    'rides.dropoff': 'Halka aad u socoto / Cinwaanka',
    'rides.price': 'Qiimaha aad bixinayso',
    'rides.submit': 'Codso Darawal Deegaan',
    'rides.driver': 'Goobta Darawalka & Khariidadda Jidka',

    // Profile View
    'profile.title': 'Habaynta Muuqaalka & Dookhyada',
    'profile.subtitle': 'Maamul dookhyadaada shakhsi ahaaneed, helitaanka iyo profile-kaaga',
    'profile.worker.mode': 'Habka Shaqaalaha',
    'profile.worker.desc': 'Dabadeed badal inta u dhaxaysa raadinta adeegyo iyo bixinta xirfadahada',
    'profile.accessibility': 'Laqabsiga Helitaanka',
    'profile.font.scale': 'Baaxadda Qoraalka',
    'profile.font.normal': 'Caadi (100%)',
    'profile.font.large': 'Wayn (115%)',
    'profile.font.xlarge': 'Aad u Wayn (130%)',
    'profile.contrast': 'Ka dhabaynta Isbarbardhiga Sare',
    'profile.theme': 'Midabka Mugdiga ah',
    'profile.lang': 'Xulashada Luuqadda',
    'profile.logout': 'Ka bax Koontada',

    // Marketplace View
    'market.title': 'Suuqa Deegaanka',
    'market.subtitle': 'Ibso ama ku bixi alaab bilaash ah deriskaada aad aaminsantahay',
    'market.add': 'Liis garee alaab iib ah',
    'market.empty': 'Ma jiraan alaab hadda diyaar ah',
    'market.free': 'BILAASH',
    'market.condition': 'Xaaladda',
    'market.contact': 'La xiriir Ibiyaha',

    // Reviews / Credentials
    'reviews.title': 'Faallooyinka la Xaqiijiyay ee Kalsoonida',
    'reviews.rating': 'Qiimaynta Deegaanka',
    'reviews.no.reviews': 'Saan hore ma u jiraan faallooyin la diiwaan geliyay.',
    'reviews.add': 'Ku dar Qiimayn la Xaqiijiyay',
    'reviews.write': 'Qor faallo gaar ah...',
    'reviews.stars': 'Dooro Qiimaynta Xiddigaha',
    'reviews.add.btn': 'Gis Qiimaynta'
  },
  cy: {
    // Navigation
    'nav.home': 'Cartref',
    'nav.marketplace': 'Marchnad',
    'nav.services': 'Gwasanaethau',
    'nav.rides': 'Teithiau',
    'nav.profile': 'Proffil',

    // Shared / Headers
    'welcome': 'Croeso',
    'welcome.back': 'Croeso yn ôl!',
    'actions.book': 'Archebu',
    'actions.book.now': 'Archebu Nawr',
    'actions.send': 'Anfon',
    'actions.cancel': 'Canslo',
    'actions.delete': 'Dileu',
    'actions.save': 'Cadw Newidiadau',
    'actions.search': 'Chwilio...',
    'actions.chat': 'Sgwrs',
    'actions.close': 'Cau',

    // Home View
    'home.board': 'Bwrdd Cymdogaeth',
    'home.board.sub': 'Cysylltwch, gofynnwch gwestiynau a chydlynu gyda thrigolion lleol',
    'home.notifications': 'Hysbysiadau Diweddar',
    'home.analytics': 'Metrigau Byw a Gwariant',
    'home.budget': 'Cyllideb Treuliau Misol',
    'home.total.spent': 'Cyfanswm a Wariwyd',
    'home.budget.limit': 'Terfyn Cyllideb',
    'home.budget.remaining': 'Yn weddill',
    'home.budget.update': 'Diweddaru Targed Cyllideb',
    'home.active.allocations': 'Dyraniadau Gwasanaeth Gweithredol',
    'home.engagement': 'Oriau Ymgysylltu Gweithredol',

    // Services View
    'services.title': 'Crefftau a Gwasanaethau Cymunedol',
    'services.subtitle': 'Arbenigwyr lleol wedi\'u gwirio yn barod i helpu o amgylch y gymdogaeth',
    'services.request': 'Gwneud Cais am Gymorth Gwasanaeth',
    'services.category': 'Categori',
    'services.description': 'Disgrifiwch eich mater/anghenion',
    'services.price': 'Iawndal a Awgrymir (£)',
    'services.address': 'Cyfeiriad Gwasanaeth',
    'services.submit': 'Cyflwyno Cais',
    'services.active': 'Traciau Cais Gweithredol',

    // Rides view
    'rides.title': 'Tacsis a Rhannu Teithiau Lleol',
    'rides.subtitle': 'Cludiant dibynadwy, rhad a ddarperir gan y gymuned i drigolion',
    'rides.pickup': 'Man Codi / Cyfeiriad',
    'rides.dropoff': 'Man Gollwng / Cyrchfan',
    'rides.price': 'Cynnig a Awgrymir',
    'rides.submit': 'Gwneud Cais am Yrrwr Cymunedol',
    'rides.driver': 'Lleoliad Gyrrwr a Map Llwybr',

    // Profile View
    'profile.title': 'Proffil a Gosodiadau Customization',
    'profile.subtitle': 'Rheoli eich dewisiadau personol, hygyrchedd, a phroffil cymunedol',
    'profile.worker.mode': 'Modd Dangosfwrdd Gweithiwr',
    'profile.worker.desc': 'Toglo i newid rhwng chwilio am wasanaethau a chynnig eich sgiliau',
    'profile.accessibility': 'Addaswyr Hygyrchedd',
    'profile.font.scale': 'Maint Graddfa Font',
    'profile.font.normal': 'Arferol (100%)',
    'profile.font.large': 'Mawr (115%)',
    'profile.font.xlarge': 'Mawr Iawn (130%)',
    'profile.contrast': 'Ffocws Cyferbyniad Uchel',
    'profile.theme': 'Thema Weledol Dywyll',
    'profile.lang': 'Dewis Iaith Rhyngwyneb',
    'profile.logout': 'Allgofnodi o\'r Cyfrif',

    // Marketplace View
    'market.title': 'Marchnad Gymunedol Leol',
    'market.subtitle': 'Prynu, gwerthu neu hawlio nwyddau am ddim gan gymdogion dibynadwy',
    'market.add': 'Restru Eitem i\'w Gwerthu',
    'market.empty': 'Dim eitemau wedi\'u rhestru ar hyn o bryd',
    'market.free': 'AM DDIM',
    'market.condition': 'Cyflwr',
    'market.contact': 'Cysylltu â\'r Gwerthwr',

    // Reviews / Credentials
    'reviews.title': 'Adolygiadau Ymddiriedolaeth Gwiriedig',
    'reviews.rating': 'Sgôr Gymunedol',
    'reviews.no.reviews': 'Nid oes tystebau gwiriedig wedi\'u rhestru eto.',
    'reviews.add': 'Rhannu Adolygiad Gwiriedig',
    'reviews.write': 'Ysgrifennu sylwadau arferol...',
    'reviews.stars': 'Dewiswch Sgôr Seren',
    'reviews.add.btn': 'Postio Adolygiad'
  },
  gd: {
    // Navigation
    'nav.home': 'Dachaigh',
    'nav.marketplace': 'Margaidh',
    'nav.services': 'Seirbheisean',
    'nav.rides': 'Tursan',
    'nav.profile': 'Pròifil',

    // Shared / Headers
    'welcome': 'Fàilte',
    'welcome.back': 'Fàilte air ais!',
    'actions.book': 'Clàraich',
    'actions.book.now': 'Clàraich a-nis',
    'actions.send': 'Cuir',
    'actions.cancel': 'Sguir',
    'actions.delete': 'Sguas às',
    'actions.save': 'Sàbhail Atharrachaidhean',
    'actions.search': 'Lorg...',
    'actions.chat': 'Cabadaich',
    'actions.close': 'Dùin',

    // Home View
    'home.board': 'Bòrd Coimhearsnachd',
    'home.board.sub': 'Ceangail, faighnich ceistean agus co-òrdanaich le luchd-àiteachaidh ionadail',
    'home.notifications': 'Brathan Verichte',
    'home.analytics': 'Metrics Beò & Caiteachas',
    'home.budget': 'Buidseat Caiteachais Mìosail',
    'home.total.spent': 'Caiteachas Iomlan',
    'home.budget.limit': 'Cridhe Buidseit',
    'home.budget.remaining': 'Air fhàgail',
    'home.budget.update': 'Ùraich Buidseat',
    'home.active.allocations': 'Seirbheisean Ghnìomhach',
    'home.engagement': 'Uairean Com-pàirteachaidh',

    // Services View
    'services.title': 'Seirbheisean Coimhearsnachd',
    'services.subtitle': 'Eòlaichean ionadail dearbhte deiseil gus do chuideachadh',
    'services.request': 'Iarr Taic Seirbheis',
    'services.category': 'Roinn',
    'services.description': 'Mìnich an duilgheadas agad',
    'services.price': 'Pàigheadh a thathar a\' moladh (£)',
    'services.address': 'Seòladh na Seirbheis',
    'services.submit': 'Cuir a-steach Iarrtas',
    'services.active': 'Tracairean Iarrtais Ghnìomhach',

    // Rides view
    'rides.title': 'Cabs & Co-roinn Turas lonadail',
    'rides.subtitle': 'Còmhdhail earbsach, saor air a stiùireadh leis a\' choimhearsnachd',
    'rides.pickup': 'Àite Togail',
    'rides.dropoff': 'Àite Fàgail',
    'rides.price': 'Tairgse a thathar a\' moladh',
    'rides.submit': 'Iarr Draibhear Coimhearsnachd',
    'rides.driver': 'Map agus Àite an Draibheir',

    // Profile View
    'profile.title': 'Pròifil & Rianachd',
    'profile.subtitle': 'Stiùirich do roghainnean pearsanta, ruigsinneachd agus ìomhaigh thar',
    'profile.worker.mode': 'Dàs-bhòrd an Labhraiche',
    'profile.worker.desc': 'Toglaich eadar a bhith a\' lorg seirbheisean agus a\' tabhann do sgilean',
    'profile.accessibility': 'Innealan Ruigsinneachd',
    'profile.font.scale': 'Meud Litrichean',
    'profile.font.normal': 'Àbhaisteach (100%)',
    'profile.font.large': 'Mòr (115%)',
    'profile.font.xlarge': 'Glè Mhòr (130%)',
    'profile.contrast': 'An t-Sùil as Àirde Conas',
    'profile.theme': 'Cuspair Dorcha',
    'profile.lang': 'Taghadh Cànain',
    'profile.logout': 'Clàraich a-mach',

    // Marketplace View
    'market.title': 'Margaidh Coimhearsnachd',
    'market.subtitle': 'Ceannaich, reic no faigh bathar an-asgaidh bho do choimhearsnaich',
    'market.add': 'Cuir nì air reic',
    'market.empty': 'Chan eil nì sam bith ann an-dràsta',
    'market.free': 'AN-ASGAIDH',
    'market.condition': 'Staid',
    'market.contact': 'Cuir fios chun neach-reic',

    // Reviews / Credentials
    'reviews.title': 'Sgrùdaidhean Earbsa Dearbhte',
    'reviews.rating': 'Ìre Coimhearsnachd',
    'reviews.no.reviews': 'Chan eil teisteanasan dearbhte ann fhathast.',
    'reviews.add': 'Sgrìobh Lèirmheas Dearbhte',
    'reviews.write': 'Sgrìobh beachdan...',
    'reviews.stars': 'Tagh Ìre Rionnag',
    'reviews.add.btn': 'Post Lèirmheas'
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    if (profile?.appLanguage && (['en', 'bn', 'pl', 'tr', 'so', 'cy', 'gd'] as string[]).includes(profile.appLanguage)) {
      setLanguageState(profile.appLanguage as Language);
    } else {
      const saved = localStorage.getItem('urbanNet_language') as Language;
      if (saved && ['en', 'bn', 'pl', 'tr', 'so', 'cy', 'gd'].includes(saved)) {
        setLanguageState(saved);
      }
    }
  }, [profile?.appLanguage]);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('urbanNet_language', lang);
    if (profile?.uid) {
      try {
        const docRef = doc(db, 'users', profile.uid);
        await updateDoc(docRef, { appLanguage: lang });
      } catch (err) {
        console.error('Failed to update language in Firestore profile', err);
      }
    }
  };

  const t = (key: string): string => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
