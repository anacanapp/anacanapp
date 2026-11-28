allprojects {
    repositories {
        google()
        mavenCentral()
        // TikTok Business SDK (TikTokEventsPlugin.kt) is published only on JitPack; restricted to its group, as the
        // Capacitor android/build.gradle.
        maven("https://jitpack.io") {
            content { includeGroup("com.github.tiktok") }
        }
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
