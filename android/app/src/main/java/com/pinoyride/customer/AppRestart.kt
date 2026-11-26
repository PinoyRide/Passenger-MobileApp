package com.pinoyride.customer

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Process
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import java.io.File

/**
 * Restarts the app from cold, so that a downloaded update starts the way it does at any start: with the loading
 * screen (LaunchScreen.kt) and expo-updates' fallback to the update before when it cannot start. Called from
 * JavaScript (src/Utils/appRestart.js) once an update is downloaded and nothing would be cut off: not during a
 * trip, a booking request or a payment (the owner, 2026-11-22). Done the way Jake Wharton's ProcessPhoenix does it:
 * [RestartActivity], in a process of its own, ends the app's process, opens the app again and ends itself.
 */
class AppRestartModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "AppRestart"

  @ReactMethod
  fun restart() {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
    val restart = Intent(context, RestartActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      .putExtra(RestartActivity.EXTRA_LAUNCH, launch)
      .putExtra(RestartActivity.EXTRA_PID, Process.myPid())
    (reactApplicationContext.currentActivity ?: context).startActivity(restart)
  }
}

class AppRestartPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(AppRestartModule(context))

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

/**
 * Runs in a process of its own (":restart", AndroidManifest.xml), so that ending the app's process does not end it:
 * ends the app's process, opens the app again from cold, and ends its own process.
 */
class RestartActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val pid = intent.getIntExtra(EXTRA_PID, -1)
    if (pid > 0 && pid != Process.myPid()) {
      Process.killProcess(pid)
    }
    val launch: Intent? = if (Build.VERSION.SDK_INT >= 33) {
      intent.getParcelableExtra(EXTRA_LAUNCH, Intent::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra(EXTRA_LAUNCH)
    }
    if (launch != null) {
      startActivity(launch)
    }
    finish()
    Runtime.getRuntime().exit(0)
  }

  companion object {
    const val EXTRA_LAUNCH = "launch"
    const val EXTRA_PID = "pid"

    /** True in the restart's own process: MainApplication then sets nothing up (no React, no update library). */
    fun isRestartProcess(): Boolean = try {
      File("/proc/self/cmdline").readText().trimEnd('\u0000', ' ', '\n').endsWith(":restart")
    } catch (e: Exception) {
      false
    }
  }
}
