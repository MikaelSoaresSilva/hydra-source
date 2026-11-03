package com.ascend.faceai.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.ascend.faceai.analysis.CaptureType
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Guarda as fotos (já recortadas e reduzidas) criptografadas com AES-256-GCM.
 * A chave fica no Android Keystore e nunca sai do aparelho.
 * A foto original da câmera/galeria NÃO é salva.
 */
class PhotoVault(context: Context) {
    private val dir = File(context.filesDir, "vault").apply { mkdirs() }
    private val alias = "ascend_photo_key_v1"

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getEntry(alias, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return gen.generateKey()
    }

    private fun file(id: String, type: CaptureType) = File(dir, "${id}_${type.name}.enc")

    fun save(id: String, type: CaptureType, bmp: Bitmap) {
        val bytes = ByteArrayOutputStream().use { bmp.compress(Bitmap.CompressFormat.JPEG, 88, it); it.toByteArray() }
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, key())
        val enc = c.doFinal(bytes)
        file(id, type).outputStream().use { out -> out.write(c.iv.size); out.write(c.iv); out.write(enc) }
    }

    fun loadBytes(id: String, type: CaptureType): ByteArray? {
        val f = file(id, type)
        if (!f.exists()) return null
        return runCatching {
            val all = f.readBytes()
            val ivLen = all[0].toInt()
            val iv = all.copyOfRange(1, 1 + ivLen)
            val c = Cipher.getInstance("AES/GCM/NoPadding")
            c.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
            c.doFinal(all, 1 + ivLen, all.size - 1 - ivLen)
        }.getOrNull()
    }

    fun load(id: String, type: CaptureType): Bitmap? = loadBytes(id, type)?.let { BitmapFactory.decodeByteArray(it, 0, it.size) }

    fun exists(id: String, type: CaptureType) = file(id, type).exists()

    fun delete(id: String) {
        dir.listFiles()?.filter { it.name.startsWith("${id}_") }?.forEach { it.delete() }
    }

    fun deleteAll() { dir.listFiles()?.forEach { it.delete() } }

    fun count(): Int = dir.listFiles()?.size ?: 0
}
