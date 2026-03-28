// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

use tokio::net::TcpListener;

use crate::error::ServerError;

/// Default starting port.
pub const DEFAULT_PORT: u16 = 8080;

/// Default ceiling (exclusive) for port scanning.
pub const DEFAULT_PORT_CEILING: u16 = 8180;

/// Find the first available port in `start..ceiling` and return the
/// bound listener along with the port number.
///
/// This eliminates any TOCTOU race by returning an already-bound
/// listener that can be passed directly to `axum::serve`.
pub async fn find_and_bind(start: u16, ceiling: u16) -> Result<(TcpListener, u16), ServerError> {
    for port in start..ceiling {
        match TcpListener::bind(("127.0.0.1", port)).await {
            Ok(listener) => return Ok((listener, port)),
            Err(_) => continue,
        }
    }
    Err(ServerError::NoAvailablePort(start, ceiling))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn find_and_bind_returns_available_port() {
        let (listener, port) = find_and_bind(18080, 18180)
            .await
            .expect("should find a port");
        assert!(port >= 18080 && port < 18180);
        drop(listener);
    }

    #[tokio::test]
    async fn find_and_bind_skips_occupied_port() {
        // Occupy the first port in the range.
        let blocker = TcpListener::bind(("127.0.0.1", 18200)).await.unwrap();
        let (_listener, port) = find_and_bind(18200, 18210)
            .await
            .expect("should find next port");
        assert!(port > 18200);
        drop(blocker);
    }

    #[tokio::test]
    async fn find_and_bind_errors_on_exhausted_range() {
        // Range of 1 port, occupy it.
        let blocker = TcpListener::bind(("127.0.0.1", 18300)).await.unwrap();
        let result = find_and_bind(18300, 18301).await;
        assert!(result.is_err());
        drop(blocker);
    }
}
