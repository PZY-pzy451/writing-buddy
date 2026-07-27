use std::{ffi::c_void, ptr};

use windows_sys::Win32::{
    Foundation::{ERROR_NOT_FOUND, GetLastError},
    Security::Credentials::{
        CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC, CREDENTIALW, CredDeleteW, CredFree,
        CredReadW, CredWriteW,
    },
};

pub const DEEPSEEK_TARGET: &str = "WritingBuddy/AI/DeepSeek/default";

pub struct SecretValue(Vec<u8>);

impl SecretValue {
    pub fn as_str(&self) -> Result<&str, String> {
        std::str::from_utf8(&self.0).map_err(|_| "secretReadFailed".to_owned())
    }
}

impl Drop for SecretValue {
    fn drop(&mut self) {
        self.0.fill(0);
    }
}

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

pub fn get(_key: &str) -> Result<Option<SecretValue>, String> {
    let target = wide(DEEPSEEK_TARGET);
    let mut raw: *mut CREDENTIALW = ptr::null_mut();
    let read = unsafe { CredReadW(target.as_ptr(), CRED_TYPE_GENERIC, 0, &mut raw) };
    if read == 0 {
        return if unsafe { GetLastError() } == ERROR_NOT_FOUND {
            Ok(None)
        } else {
            Err("secretReadFailed".to_owned())
        };
    }
    if raw.is_null() {
        return Err("secretReadFailed".to_owned());
    }
    let credential = unsafe { &mut *raw };
    let value = if credential.CredentialBlob.is_null() || credential.CredentialBlobSize == 0 {
        Err("secretReadFailed".to_owned())
    } else {
        let bytes = unsafe {
            std::slice::from_raw_parts(
                credential.CredentialBlob,
                credential.CredentialBlobSize as usize,
            )
        };
        Ok(SecretValue(bytes.to_vec()))
    };
    if !credential.CredentialBlob.is_null() {
        unsafe {
            ptr::write_bytes(
                credential.CredentialBlob,
                0,
                credential.CredentialBlobSize as usize,
            );
        }
    }
    unsafe { CredFree(raw.cast::<c_void>()) };
    value.map(Some)
}

pub fn set(_key: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() || value.len() > 16_384 {
        return Err("invalidSecretValue".to_owned());
    }
    let mut target = wide(DEEPSEEK_TARGET);
    let mut username = wide("Writing Buddy");
    let mut comment = wide("DeepSeek API key for Writing Buddy");
    let mut blob = value.as_bytes().to_vec();
    let mut credential = CREDENTIALW {
        Type: CRED_TYPE_GENERIC,
        TargetName: target.as_mut_ptr(),
        Comment: comment.as_mut_ptr(),
        CredentialBlobSize: blob.len() as u32,
        CredentialBlob: blob.as_mut_ptr(),
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        UserName: username.as_mut_ptr(),
        ..Default::default()
    };
    let result = unsafe { CredWriteW(&mut credential, 0) };
    blob.fill(0);
    if result == 0 {
        Err("secretWriteFailed".to_owned())
    } else {
        Ok(())
    }
}

pub fn delete(_key: &str) -> Result<(), String> {
    let target = wide(DEEPSEEK_TARGET);
    let deleted = unsafe { CredDeleteW(target.as_ptr(), CRED_TYPE_GENERIC, 0) };
    if deleted != 0 || unsafe { GetLastError() } == ERROR_NOT_FOUND {
        Ok(())
    } else {
        Err("secretDeleteFailed".to_owned())
    }
}

#[cfg(test)]
mod tests {
    use super::DEEPSEEK_TARGET;

    #[test]
    fn credential_target_is_stable_and_scoped() {
        assert_eq!(DEEPSEEK_TARGET, "WritingBuddy/AI/DeepSeek/default");
    }
}
