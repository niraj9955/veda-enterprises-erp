# Keep Veda ERP app classes
-keep class com.veda.enterprises.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-dontwarn android.webkit.**
