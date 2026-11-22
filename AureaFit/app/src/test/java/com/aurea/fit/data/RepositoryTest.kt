package com.aurea.fit.data

import android.app.AlarmManager
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.aurea.fit.AureaApp
import com.aurea.fit.domain.*
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.io.File

@RunWith(AndroidJUnit4::class)
@Config(sdk = [35])
class RepositoryTest {
    private val app = ApplicationProvider.getApplicationContext<AureaApp>()
    private val repo = app.container.repository

    @Test fun accountProfilePlansSessionsBackupAndDelete() = runBlocking {
        assertTrue(repo.register("Ana", "ana@x.com", "123456") is AuthResult.Ok)
        assertTrue(repo.register("Ana", "ana@x.com", "123456") is AuthResult.Error)
        repo.logout()
        assertTrue(repo.login("ana@x.com", "errada") is AuthResult.Error)
        assertTrue(repo.login("ANA@x.com ", "123456") is AuthResult.Ok)

        val p = UserProfile(name = "Ana", goal = Goal.LOSE_FAT)
        repo.saveProfile(p, "inicial")
        val plan = repo.activeWorkoutPlan()!!
        val day = plan.days.first()
        val ex = day.exercises.first()
        val id = repo.saveSession(day.index, day.title, listOf(Repository.LoggedExercise(ex.exerciseId, listOf(SetEntry(20.0, 12), SetEntry(20.0, 12)), 7, true, false)), 40)
        assertTrue(id > 0)
        assertEquals(2, repo.lastSets(ex.exerciseId).size)
        assertEquals(7, repo.lastFeedback(ex.exerciseId)!!.rpe)

        val am = app.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        assertTrue(shadowOf(am).scheduledAlarms.isNotEmpty())

        val (cid, recs) = repo.submitCheckIn(CheckInAnswers(sleep = 1, recovery = 1))
        assertTrue(recs.any { it.action == ActionType.DELOAD })
        repo.applyRecommendations(cid, recs.filter { it.action == ActionType.DELOAD })
        assertEquals(-1, repo.activeWorkoutPlan()!!.setsDelta)
        val workouts = repo.db.plans().all().filter { it.kind == "WORKOUT" }
        assertEquals(2, workouts.size)
        assertTrue(workouts.last().reason.contains("Check-in"))
        repo.restorePlan(workouts.first())
        assertEquals(0, repo.activeWorkoutPlan()!!.setsDelta)

        val diet = repo.activeDietPlan()!!
        val item = diet.days[0].meals[0].items[0]
        val sub = DietGenerator.substitutes(item, p).first()
        repo.swapFood(0, 0, 0, sub, allDays = false)
        assertEquals(sub.foodId, repo.activeDietPlan()!!.days[0].meals[0].items[0].foodId)

        repo.addWater(300)
        repo.addMeasurement(MeasurementEntity(epochDay = today(), weightKg = 60.0))
        File(repo.photoDir, "teste.jpg").writeBytes(byteArrayOf(1, 2, 3))
        repo.db.progress().insertPhoto(PhotoEntity(epochDay = today(), fileName = "teste.jpg"))
        val zip = File(app.cacheDir, "b.zip")
        val uri = android.net.Uri.fromFile(zip)
        assertEquals(1, repo.backup.exportTo(uri, true).getOrThrow())
        repo.deleteEverything()
        assertNull(repo.db.account().get())
        assertFalse(File(repo.photoDir, "teste.jpg").exists())
        assertFalse(repo.settings.state.value.loggedIn)
        repo.backup.importFrom(uri).getOrThrow()
        assertNotNull(repo.db.account().get())
        assertEquals(300, repo.db.water().all().sumOf { it.ml })
        assertEquals(1, repo.db.workouts().allSessions().size)
        assertTrue(File(repo.photoDir, "teste.jpg").exists())
        assertNotNull(repo.activeWorkoutPlan())
    }
}
