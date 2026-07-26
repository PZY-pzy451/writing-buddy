const SERVICE: &str = "Writing Buddy Next";

fn entry(key: &str) -> Result<keyring::Entry, String> {
    if key.is_empty()
        || key.len() > 128
        || !key.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
        })
    {
        return Err("invalidSecretKey".to_owned());
    }
    keyring::Entry::new(SERVICE, key).map_err(|_| "secretStoreUnavailable".to_owned())
}

pub fn get(key: &str) -> Result<Option<String>, String> {
    match entry(key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("secretReadFailed".to_owned()),
    }
}

pub fn set(key: &str, value: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > 16_384 {
        return Err("invalidSecretValue".to_owned());
    }
    entry(key)?
        .set_password(value)
        .map_err(|_| "secretWriteFailed".to_owned())
}

pub fn delete(key: &str) -> Result<(), String> {
    match entry(key)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("secretDeleteFailed".to_owned()),
    }
}
