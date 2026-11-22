package com.pinoyride.customer

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.TextView
import androidx.core.content.res.ResourcesCompat
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.ReactMarker
import com.facebook.react.bridge.ReactMarker.MarkerListener
import com.facebook.react.bridge.ReactMarkerConstants
import com.facebook.react.uimanager.util.ReactFindViewUtil
import expo.modules.updates.UpdatesController

/**
 * What a person sees from opening the app until its first screen is ready: the logo, a line that keeps
 * moving, and one sentence saying what the app is doing.
 *
 * Before the app starts it asks the Pinoy Ride backend for an update and waits until it is in
 * (EXPO_UPDATES_LAUNCH_WAIT_MS in AndroidManifest.xml; README, "SELF-UPDATES"). Nothing of the app exists
 * during that wait, so without this the window is blank. This is plain Android views laid over the window
 * (res/layout/launch_screen.xml), in the look of the app's own first screen (SplashScreen.js), which takes
 * over from it.
 *
 * It leaves when the app's root view is drawn: the view App.js marks with nativeID "app-ready". Should that
 * never come it leaves a little after the app's first content appears, and at the latest after GIVE_UP_MS.
 *
 * Nothing here may stop the app from starting: every step that could fail is allowed to, and the app then
 * starts as it did before this screen existed.
 */
class LaunchScreen private constructor(private val activity: Activity) {
  private val main = Handler(Looper.getMainLooper())
  private var screen: View? = null
  private var sentence: TextView? = null
  private var movingLine: ObjectAnimator? = null
  private var said = 0
  private var leaving = false

  /** The part of the window the app draws in. */
  private var appArea: View? = null
  private val appAreaChanged = View.OnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
    main.post { standWhereTheAppWillDraw() }
  }

  /** True once React Native has begun to start: the wait for an update is over. Written from any thread. */
  @Volatile
  private var appIsStarting = false

  private val look = object : Runnable {
    override fun run() {
      if (leaving) {
        return
      }
      try {
        say(whatIsHappening())
      } catch (e: Throwable) {
        // the sentence stays as it is
      }
      main.postDelayed(this, LOOK_EVERY_MS)
    }
  }

  private val leaveNow = Runnable { leave() }

  // React Native reports its start-up steps from whichever thread takes them.
  private val steps = MarkerListener { name, _, _ ->
    if (name == ReactMarkerConstants.CREATE_REACT_CONTEXT_START) {
      appIsStarting = true
    } else if (name == ReactMarkerConstants.CONTENT_APPEARED) {
      main.postDelayed(leaveNow, LEAVE_AFTER_FIRST_CONTENT_MS)
    }
  }

  // Told, on the main thread, when the view the app marks as its root is created.
  private val appRoot = object : ReactFindViewUtil.OnViewFoundListener {
    override fun getNativeId(): String = APP_ROOT_NATIVE_ID

    override fun onViewFound(view: View) {
      main.postDelayed(leaveNow, LEAVE_AFTER_APP_ROOT_MS)
    }
  }

  private fun show() {
    val window = activity.window ?: return
    val decor = window.decorView as? ViewGroup ?: return

    // On the window itself, above the activity's content: the content is replaced when the app loads
    // (setContentView), this is not.
    val view = LayoutInflater.from(activity).inflate(R.layout.launch_screen, decor, false)
    decor.addView(view)
    screen = view

    sentence = view.findViewById(R.id.launch_status)
    try {
      ResourcesCompat.getFont(activity, R.font.poppins_regular)?.let { sentence?.typeface = it }
    } catch (e: Throwable) {
      // the phone's own typeface will do
    }

    val track: View? = view.findViewById(R.id.launch_track)
    val bar: View? = view.findViewById(R.id.launch_bar)
    track?.clipToOutline = true
    // Once the sizes are known and before the first frame is drawn
    view.viewTreeObserver.addOnPreDrawListener(object : ViewTreeObserver.OnPreDrawListener {
      override fun onPreDraw(): Boolean {
        try {
          val observer = view.viewTreeObserver
          if (observer.isAlive) {
            observer.removeOnPreDrawListener(this)
          }
          // Asked of the window, not of the activity: the activity would build its own layer for the answer
          appArea = decor.findViewById<View>(android.R.id.content)?.also {
            it.addOnLayoutChangeListener(appAreaChanged)
          }
          val moved = standWhereTheAppWillDraw()
          if (track != null && bar != null && movingLine == null) {
            move(bar, track)
          }
          // After moving, lay out again before anything is drawn
          return !moved
        } catch (e: Throwable) {
          Log.w(TAG, "The launch screen could not be laid out", e)
          return true
        }
      }
    })

    appIsStarting = appAlreadyRuns()
    ReactMarker.addListener(steps)
    ReactFindViewUtil.addViewListener(appRoot)
    look.run()
    main.postDelayed(leaveNow, GIVE_UP_MS)
  }

  /**
   * The app draws inside the activity's content area, which on some phones starts below the status bar.
   * Centring in the same area puts the logo exactly where the app's first screen will draw it.
   * Returns true when the screen's insides were moved for that.
   */
  private fun standWhereTheAppWillDraw(): Boolean {
    try {
      val view = screen ?: return false
      val content = appArea ?: return false
      if (content.width <= 0 || content.height <= 0 || view.width <= 0 || view.height <= 0) {
        return false
      }
      val ours = IntArray(2)
      val theirs = IntArray(2)
      view.getLocationInWindow(ours)
      content.getLocationInWindow(theirs)
      val left = theirs[0] - ours[0]
      val top = theirs[1] - ours[1]
      val right = view.width - left - content.width
      val bottom = view.height - top - content.height
      if (left < 0 || top < 0 || right < 0 || bottom < 0) {
        return false
      }
      if (left == view.paddingLeft && top == view.paddingTop &&
        right == view.paddingRight && bottom == view.paddingBottom
      ) {
        return false
      }
      view.setPadding(left, top, right, bottom)
      return true
    } catch (e: Throwable) {
      return false // centred in the window, then
    }
  }

  private fun move(bar: View, track: View) {
    val density = activity.resources.displayMetrics.density
    val barWidth = if (bar.width > 0) bar.width.toFloat() else BAR_DP * density
    val trackWidth = if (track.width > 0) track.width.toFloat() else TRACK_DP * density
    bar.translationX = -barWidth
    movingLine = ObjectAnimator.ofFloat(bar, View.TRANSLATION_X, -barWidth, trackWidth).apply {
      duration = LINE_CROSSES_IN_MS
      repeatCount = ValueAnimator.INFINITE
      repeatMode = ValueAnimator.RESTART
      interpolator = AccelerateDecelerateInterpolator()
      start()
    }
  }

  /**
   * The sentence for this moment. Until React Native starts, the app is waiting on the update check: the
   * update library says whether it has found one and is fetching it.
   */
  private fun whatIsHappening(): Int {
    if (appIsStarting) {
      return R.string.launch_starting
    }
    val downloading = try {
      UpdatesController.instance.getConstantsForModule().initialContext.isDownloading
    } catch (e: Throwable) {
      false // the update library has not been set up yet: the check is about to begin
    }
    return if (downloading) R.string.launch_downloading else R.string.launch_checking
  }

  private fun say(text: Int) {
    if (text == said) {
      return
    }
    said = text
    sentence?.setText(text)
  }

  /** True when the activity was created again while the app itself kept running: there is no wait then. */
  private fun appAlreadyRuns(): Boolean = try {
    val host = (activity.application as ReactApplication).reactNativeHost
    host.hasInstance() && host.reactInstanceManager.currentReactContext != null
  } catch (e: Throwable) {
    false
  }

  private fun leave() {
    if (leaving) {
      return
    }
    leaving = true
    try {
      stopWatching()
      val view = screen
      if (view == null) {
        remove()
        return
      }
      view.animate().alpha(0f).setDuration(FADE_MS).withEndAction { removeQuietly() }.start()
    } catch (e: Throwable) {
      Log.w(TAG, "The launch screen could not fade out", e)
      removeQuietly()
    }
  }

  private fun stopWatching() {
    main.removeCallbacksAndMessages(null)
    ReactMarker.removeListener(steps)
    ReactFindViewUtil.removeViewListener(appRoot)
  }

  private fun remove() {
    movingLine?.cancel()
    movingLine = null
    appArea?.removeOnLayoutChangeListener(appAreaChanged)
    appArea = null
    val view = screen ?: return
    screen = null
    sentence = null
    (view.parent as? ViewGroup)?.removeView(view)
  }

  private fun removeQuietly() {
    try {
      remove()
    } catch (e: Throwable) {
      Log.w(TAG, "The launch screen could not be taken down", e)
    }
  }

  /** The activity is going away: take everything down at once. */
  fun dispose() {
    try {
      leaving = true
      stopWatching()
      screen?.animate()?.cancel()
      remove()
    } catch (e: Throwable) {
      Log.w(TAG, "The launch screen could not be taken down", e)
    }
  }

  companion object {
    private const val TAG = "LaunchScreen"

    /** The nativeID App.js gives the app's root view. Keep the two the same. */
    const val APP_ROOT_NATIVE_ID = "app-ready"

    private const val LOOK_EVERY_MS = 150L
    /** Time for the app's first screen to draw its logo under this one before this one fades. */
    private const val LEAVE_AFTER_APP_ROOT_MS = 300L
    /** When the app's root view is never reported: this long after React Native's first content. */
    private const val LEAVE_AFTER_FIRST_CONTENT_MS = 2500L
    /** Past the update wait (EXPO_UPDATES_LAUNCH_WAIT_MS, at most 2 minutes) and the app's own start. */
    private const val GIVE_UP_MS = 150000L
    private const val FADE_MS = 220L
    private const val LINE_CROSSES_IN_MS = 1100L
    private const val BAR_DP = 44f
    private const val TRACK_DP = 132f

    /**
     * Puts the launch screen over [activity]'s window, or returns null when it cannot (the app then starts
     * with a blank window, as before). Not in debug builds: they load from the computer and show their own
     * progress and errors.
     */
    @JvmStatic
    fun show(activity: Activity): LaunchScreen? {
      if (BuildConfig.DEBUG) {
        return null
      }
      var launch: LaunchScreen? = null
      return try {
        launch = LaunchScreen(activity)
        launch.show()
        launch
      } catch (e: Throwable) {
        Log.w(TAG, "The launch screen could not be shown", e)
        launch?.dispose()
        null
      }
    }
  }
}
