use crate::ai::errors::{AiErrorCode, PublicAiError};

const MAX_EVENT_BYTES: usize = 2 * 1024 * 1024;

#[derive(Debug, Eq, PartialEq)]
pub enum SseFrame {
    Data(String),
    Done,
}

#[derive(Default)]
pub struct SseDecoder {
    buffer: Vec<u8>,
    data_lines: Vec<String>,
}

impl SseDecoder {
    pub fn push(&mut self, bytes: &[u8]) -> Result<Vec<SseFrame>, PublicAiError> {
        if self.buffer.len().saturating_add(bytes.len()) > MAX_EVENT_BYTES {
            return Err(PublicAiError::new(AiErrorCode::StreamParseFailed));
        }
        self.buffer.extend_from_slice(bytes);
        let mut frames = Vec::new();
        while let Some(position) = self.buffer.iter().position(|byte| *byte == b'\n') {
            let mut line = self.buffer.drain(..=position).collect::<Vec<_>>();
            line.pop();
            if line.last() == Some(&b'\r') {
                line.pop();
            }
            self.process_line(&line, &mut frames)?;
        }
        Ok(frames)
    }

    pub fn finish(mut self) -> Result<Vec<SseFrame>, PublicAiError> {
        let mut frames = Vec::new();
        if !self.buffer.is_empty() {
            let line = std::mem::take(&mut self.buffer);
            self.process_line(&line, &mut frames)?;
        }
        self.dispatch(&mut frames);
        Ok(frames)
    }

    fn process_line(
        &mut self,
        bytes: &[u8],
        frames: &mut Vec<SseFrame>,
    ) -> Result<(), PublicAiError> {
        let line = std::str::from_utf8(bytes)
            .map_err(|_| PublicAiError::new(AiErrorCode::StreamParseFailed))?;
        if line.is_empty() {
            self.dispatch(frames);
        } else if !line.starts_with(':')
            && let Some(data) = line.strip_prefix("data:")
        {
            self.data_lines
                .push(data.strip_prefix(' ').unwrap_or(data).to_owned());
            if self.data_lines.iter().map(String::len).sum::<usize>() > MAX_EVENT_BYTES {
                return Err(PublicAiError::new(AiErrorCode::StreamParseFailed));
            }
        }
        Ok(())
    }

    fn dispatch(&mut self, frames: &mut Vec<SseFrame>) {
        if self.data_lines.is_empty() {
            return;
        }
        let data = self.data_lines.join("\n");
        self.data_lines.clear();
        if data.trim() == "[DONE]" {
            frames.push(SseFrame::Done);
        } else {
            frames.push(SseFrame::Data(data));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{SseDecoder, SseFrame};

    #[test]
    fn parses_lf_crlf_comments_and_done() {
        let mut decoder = SseDecoder::default();
        let frames = decoder
            .push(b": keepalive\r\ndata: {\"a\":1}\r\n\r\ndata: [DONE]\n\n")
            .expect("valid SSE");
        assert_eq!(
            frames,
            vec![SseFrame::Data("{\"a\":1}".to_owned()), SseFrame::Done]
        );
    }

    #[test]
    fn preserves_split_multibyte_characters() {
        let payload = "data: 雨\n\n".as_bytes();
        let split = payload.len() - 2;
        let mut decoder = SseDecoder::default();
        assert!(decoder.push(&payload[..split]).expect("partial").is_empty());
        assert_eq!(
            decoder.push(&payload[split..]).expect("completed"),
            vec![SseFrame::Data("雨".to_owned())]
        );
    }

    #[test]
    fn joins_multiple_data_lines() {
        let mut decoder = SseDecoder::default();
        let frames = decoder
            .push(b"data: first\ndata: second\n\n")
            .expect("valid SSE");
        assert_eq!(frames, vec![SseFrame::Data("first\nsecond".to_owned())]);
    }

    #[test]
    fn finish_flushes_a_final_event_without_blank_line() {
        let mut decoder = SseDecoder::default();
        assert!(decoder.push(b"data: final").expect("partial").is_empty());
        assert_eq!(
            decoder.finish().expect("final"),
            vec![SseFrame::Data("final".to_owned())]
        );
    }
}
