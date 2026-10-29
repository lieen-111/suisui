plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "io.github.lieen111.suisui"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.github.lieen111.suisui"
        minSdk = 26
        targetSdk = 35
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = "0.3.0"
    }

    // Test-only key, committed on purpose so every CI build can update the installed app without
    // losing data. Replace with a private key (kept out of the repo) before any public release.
    signingConfigs {
        create("test") {
            storeFile = file("../keystore/suisui-test.jks")
            storePassword = "suisui-test"
            keyAlias = "suisui"
            keyPassword = "suisui-test"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("test")
        }
        debug {
            signingConfig = signingConfigs.getByName("test")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }

    // The web app in ../../app is bundled as-is and served from https://appassets.androidplatform.net/assets/
    sourceSets["main"].assets.srcDir("build/generated/webapp")
}

val copyWebApp by tasks.registering(Sync::class) {
    from(rootProject.file("../app")) {
        exclude("README.md", "*-preview.png")
    }
    into(layout.buildDirectory.dir("generated/webapp"))
}
tasks.named("preBuild") { dependsOn(copyWebApp) }

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
}
