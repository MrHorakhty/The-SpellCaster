import java.io.File
import org.apache.tools.ant.taskdefs.condition.Os
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.logging.LogLevel
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction
import org.gradle.process.ExecResult

open class BuildTask : DefaultTask() {
    @Input
    var rootDirRel: String? = null
    @Input
    var target: String? = null
    @Input
    var release: Boolean? = null

    @TaskAction
    fun assemble() {
        val candidates = if (Os.isFamily(Os.FAMILY_WINDOWS)) {
            listOf("npm.cmd", "npm.exe", "npm.bat", "npm")
        } else listOf("npm")
        val failures = mutableListOf<String>()
        var lastException: Exception? = null
        for (executable in candidates) {
            val result = try {
                runTauriCli(executable)
            } catch (e: Exception) {
                failures.add("$executable: ${e.message}")
                lastException = e
                continue
            }
            // A started npm process can fail because Rust or the Tauri CLI
            // failed. Preserve that error; trying npm.bat would hide it.
            result.assertNormalExitValue()
            return
        }
        throw GradleException("Could not start npm. Attempts:\n${failures.joinToString("\n")}", lastException)
    }

    fun runTauriCli(executable: String): ExecResult {
        val rootDirRel = rootDirRel ?: throw GradleException("rootDirRel cannot be null")
        val target = target ?: throw GradleException("target cannot be null")
        val release = release ?: throw GradleException("release cannot be null")
        val args = listOf("run", "--", "tauri", "android", "android-studio-script");

        return project.exec {
            isIgnoreExitValue = true
            workingDir(File(project.projectDir, rootDirRel))
            executable(executable)
            args(args)
            if (project.logger.isEnabled(LogLevel.DEBUG)) {
                args("-vv")
            } else if (project.logger.isEnabled(LogLevel.INFO)) {
                args("-v")
            }
            if (release) {
                args("--release")
            }
            args(listOf("--target", target))
        }
    }
}
