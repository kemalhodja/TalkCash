package io.talkcash.app.tile

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import androidx.annotation.RequiresApi

@RequiresApi(Build.VERSION_CODES.N)
class QuickWhisperTileService : TileService() {
    override fun onClick() {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("talkcash://quick-voice?hold=1&source=tile"))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        intent.setPackage(packageName)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startActivityAndCollapse(intent)
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(intent)
        }
    }

    override fun onStartListening() {
        qsTile?.apply {
            label = "Fısıltı"
            contentDescription = "TalkCash Hızlı Fısıltı"
            state = Tile.STATE_ACTIVE
            updateTile()
        }
    }
}
