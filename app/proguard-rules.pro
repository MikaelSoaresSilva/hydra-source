# MediaPipe / TFLite usam JNI e reflexão
-keep class com.google.mediapipe.** { *; }
-keep class com.google.protobuf.** { *; }
-dontwarn com.google.mediapipe.**
-dontwarn com.google.protobuf.**
-dontwarn javax.annotation.**
-dontwarn com.google.auto.value.**
# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-keepclassmembers class com.ascend.faceai.** { *** Companion; }
-keepclasseswithmembers class com.ascend.faceai.** { kotlinx.serialization.KSerializer serializer(...); }
-keep,includedescriptorclasses class com.ascend.faceai.**$$serializer { *; }
