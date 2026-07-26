use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SafeLogEvent<'a> {
    pub event: &'a str,
    pub severity: &'a str,
    pub project_token: Option<&'a str>,
    pub code: Option<&'a str>,
}

pub fn event(event: &str, severity: &str, project_token: Option<&str>, code: Option<&str>) {
    let value = SafeLogEvent {
        event,
        severity,
        project_token,
        code,
    };
    if let Ok(serialized) = serde_json::to_string(&value) {
        eprintln!("{serialized}");
    }
}
