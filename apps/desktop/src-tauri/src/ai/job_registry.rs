use std::collections::HashMap;

use tokio_util::sync::CancellationToken;

#[derive(Default)]
pub struct AiJobRegistry {
    jobs: HashMap<String, CancellationToken>,
}

impl AiJobRegistry {
    pub fn start(&mut self, job_id: String) -> CancellationToken {
        for token in self.jobs.values() {
            token.cancel();
        }
        self.jobs.clear();
        let token = CancellationToken::new();
        self.jobs.insert(job_id, token.clone());
        token
    }

    pub fn cancel(&mut self, job_id: &str) -> bool {
        self.jobs.remove(job_id).is_some_and(|token| {
            token.cancel();
            true
        })
    }

    pub fn finish(&mut self, job_id: &str) {
        self.jobs.remove(job_id);
    }

    pub fn cancel_all(&mut self) {
        for token in self.jobs.values() {
            token.cancel();
        }
        self.jobs.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::AiJobRegistry;

    #[test]
    fn starting_a_job_cancels_the_previous_one() {
        let mut registry = AiJobRegistry::default();
        let first = registry.start("one".to_owned());
        let second = registry.start("two".to_owned());
        assert!(first.is_cancelled());
        assert!(!second.is_cancelled());
        assert!(!registry.cancel("one"));
        assert!(registry.cancel("two"));
        assert!(second.is_cancelled());
    }
}
