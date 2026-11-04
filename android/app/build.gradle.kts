plugins { id("com.android.application") }
android {
 namespace = "ru.kupiora.radar"
 compileSdk = 36
 defaultConfig { applicationId = "ru.kupiora.radar"; minSdk = 26; targetSdk = 36; versionCode = 7; versionName = "0.7.0" }
}

dependencies { testImplementation("junit:junit:4.13.2"); testImplementation("org.json:json:20240303") }
