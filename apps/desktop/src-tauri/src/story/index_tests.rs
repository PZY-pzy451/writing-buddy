use std::{
    fs,
    time::{Instant, SystemTime, UNIX_EPOCH},
};

use super::index::{
    IndexMutation, IndexQuery, IndexRecord, StoryIndex, StoryIndexSnapshot, load_project_index,
    persist_project_index, rebuild_project_index, remove_project_index,
};

fn record(
    id: impl Into<String>,
    kind: impl Into<String>,
    chapter_id: Option<String>,
    participant_ids: Vec<String>,
    related_resource_ids: Vec<String>,
) -> IndexRecord {
    IndexRecord {
        id: id.into(),
        kind: kind.into(),
        revision: 0,
        chapter_id,
        scene_id: None,
        participant_ids,
        related_resource_ids,
    }
}

#[test]
fn rebuilds_and_queries_deterministically() {
    let records = vec![
        record(
            "timeline-event:arrival",
            "timelineEvent",
            Some("chapter:one".to_owned()),
            vec!["character:lin".to_owned()],
            vec!["location:station".to_owned()],
        ),
        record(
            "scene:station",
            "scene",
            Some("chapter:one".to_owned()),
            vec!["character:lin".to_owned()],
            Vec::new(),
        ),
        record("character:lin", "character", None, Vec::new(), Vec::new()),
    ];

    let index = StoryIndex::rebuild(records.clone());
    assert_eq!(index.stats().record_count, 3);
    assert_eq!(
        index
            .query(&IndexQuery {
                kind: Some("scene".to_owned()),
                ..IndexQuery::default()
            })
            .ids,
        vec!["scene:station"]
    );
    assert_eq!(
        index
            .query(&IndexQuery {
                participant_id: Some("character:lin".to_owned()),
                ..IndexQuery::default()
            })
            .ids,
        vec!["scene:station", "timeline-event:arrival"]
    );

    let reversed = StoryIndex::rebuild(records.into_iter().rev().collect());
    assert_eq!(index.source_fingerprint(), reversed.source_fingerprint());
    assert_eq!(index.snapshot(), reversed.snapshot());
}

#[test]
fn incrementally_replaces_reverse_links_and_removes_records() {
    let mut index = StoryIndex::rebuild(vec![record(
        "timeline-event:arrival",
        "timelineEvent",
        Some("chapter:one".to_owned()),
        vec!["character:lin".to_owned()],
        Vec::new(),
    )]);

    let changed = index.apply(&[
        IndexMutation::Upsert(record(
            "timeline-event:arrival",
            "timelineEvent",
            Some("chapter:two".to_owned()),
            vec!["character:shen".to_owned()],
            Vec::new(),
        )),
        IndexMutation::Upsert(record("item:key", "item", None, Vec::new(), Vec::new())),
    ]);
    assert_eq!(changed.upserted, 2);
    assert_eq!(changed.removed, 0);
    assert!(
        index
            .query(&IndexQuery {
                participant_id: Some("character:lin".to_owned()),
                ..IndexQuery::default()
            })
            .ids
            .is_empty()
    );
    assert_eq!(
        index
            .query(&IndexQuery {
                chapter_id: Some("chapter:two".to_owned()),
                ..IndexQuery::default()
            })
            .ids,
        vec!["timeline-event:arrival"]
    );

    let removed = index.apply(&[IndexMutation::Remove("item:key".to_owned())]);
    assert_eq!(removed.removed, 1);
    assert_eq!(index.stats().record_count, 1);
}

#[test]
fn persisted_snapshot_round_trips_without_author_content() {
    let index = StoryIndex::rebuild(vec![record(
        "mention:one",
        "mention",
        Some("chapter:one".to_owned()),
        Vec::new(),
        vec!["character:lin".to_owned()],
    )]);
    let serialized = serde_json::to_vec(&index.snapshot()).expect("serialize index snapshot");
    let snapshot: StoryIndexSnapshot =
        serde_json::from_slice(&serialized).expect("parse index snapshot");
    let restored = StoryIndex::from_snapshot(snapshot).expect("restore derived index");

    assert_eq!(restored.snapshot(), index.snapshot());
    assert!(
        !String::from_utf8(serialized)
            .expect("index json")
            .contains("manuscript")
    );
}

#[test]
fn rebuilds_persists_and_removes_a_project_index_on_disk() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock after unix epoch")
        .as_nanos();
    let project_root = std::env::temp_dir().join(format!(
        "writing-buddy-story-index-{}-{nonce}",
        std::process::id()
    ));
    fs::create_dir_all(project_root.join(".writing-buddy")).expect("create metadata directory");
    fs::create_dir_all(project_root.join("story").join("scenes")).expect("create story directory");
    fs::write(
        project_root.join(".writing-buddy").join("project.json"),
        br#"{
            "schemaVersion": 1,
            "projectId": "project:index-test",
            "title": "Index test",
            "volumes": [{
                "id": "volume:one",
                "title": "Volume one",
                "chapters": [{"id": "one", "title": "Chapter one"}]
            }]
        }"#,
    )
    .expect("write project manifest");
    fs::write(
        project_root
            .join("story")
            .join("scenes")
            .join("scene-one.json"),
        br#"{
            "schemaVersion": 1,
            "id": "scene:one",
            "type": "scene",
            "revision": 3,
            "chapterId": "chapter:one",
            "participantIds": ["character:lin"]
        }"#,
    )
    .expect("write story resource");

    let root_text = project_root.to_string_lossy();
    let (canonical_root, index) =
        rebuild_project_index(&root_text).expect("rebuild derived project index");
    assert_eq!(index.stats().record_count, 2);
    assert_eq!(
        index
            .query(&IndexQuery {
                participant_id: Some("character:lin".to_owned()),
                ..IndexQuery::default()
            })
            .ids,
        vec!["scene:one"]
    );

    persist_project_index(&canonical_root, &index).expect("persist derived index");
    let (_, restored) = load_project_index(&root_text).expect("load derived index");
    assert_eq!(restored.snapshot(), index.snapshot());

    remove_project_index(&canonical_root).expect("remove derived index");
    assert!(load_project_index(&root_text).is_err());
    fs::remove_dir_all(&project_root).expect("remove test project");
}

fn large_fixture_records() -> Vec<IndexRecord> {
    let mut records = Vec::with_capacity(266_000);
    for index in 0..1_000 {
        records.push(record(
            format!("chapter:{index:04}"),
            "chapter",
            None,
            Vec::new(),
            Vec::new(),
        ));
    }
    for index in 0..10_000 {
        records.push(record(
            format!("scene:{index:05}"),
            "scene",
            Some(format!("chapter:{:04}", index % 1_000)),
            vec![format!("character:{:04}", index % 250)],
            Vec::new(),
        ));
    }
    for index in 0..5_000 {
        records.push(record(
            format!("character:{index:04}"),
            "character",
            None,
            Vec::new(),
            Vec::new(),
        ));
    }
    for index in 0..50_000 {
        let kind = if index % 2 == 0 {
            "timelineEvent"
        } else {
            "state"
        };
        records.push(record(
            format!(
                "{}:{index:05}",
                if kind == "state" {
                    "state"
                } else {
                    "timeline-event"
                }
            ),
            kind,
            Some(format!("chapter:{:04}", index % 1_000)),
            vec![format!("character:{:04}", index % 250)],
            vec![format!("scene:{:05}", index % 10_000)],
        ));
    }
    for index in 0..200_000 {
        records.push(record(
            format!("mention:{index:06}"),
            "mention",
            Some(format!("chapter:{:04}", index % 1_000)),
            Vec::new(),
            vec![format!("character:{:04}", index % 5_000)],
        ));
    }
    records
}

#[test]
#[ignore = "run through scripts/perf/measure-storyforge.ps1 in release mode"]
fn large_fixture_meets_storyforge_performance_gates() {
    let records = large_fixture_records();

    let started = Instant::now();
    let mut index = StoryIndex::rebuild(records);
    let project_interactive_ms = started.elapsed().as_secs_f64() * 1_000.0;

    let started = Instant::now();
    let resources = index.query(&IndexQuery {
        kind: Some("character".to_owned()),
        limit: 50,
        ..IndexQuery::default()
    });
    let resource_switch_ms = started.elapsed().as_secs_f64() * 1_000.0;

    let started = Instant::now();
    index.apply(&[IndexMutation::Upsert(record(
        "item:performance-save",
        "item",
        Some("chapter:0001".to_owned()),
        Vec::new(),
        Vec::new(),
    ))]);
    let single_resource_save_ms = started.elapsed().as_secs_f64() * 1_000.0;

    let started = Instant::now();
    let timeline = index.query(&IndexQuery {
        kind: Some("timelineEvent".to_owned()),
        limit: 200,
        ..IndexQuery::default()
    });
    let timeline_feedback_ms = started.elapsed().as_secs_f64() * 1_000.0;

    let started = Instant::now();
    let graph = index.query(&IndexQuery {
        participant_id: Some("character:0042".to_owned()),
        limit: 500,
        ..IndexQuery::default()
    });
    let filtered_graph_ms = started.elapsed().as_secs_f64() * 1_000.0;

    assert_eq!(index.stats().record_count, 266_001);
    assert_eq!(resources.ids.len(), 50);
    assert_eq!(timeline.ids.len(), 200);
    assert!(!graph.ids.is_empty());
    assert!(project_interactive_ms < 2_500.0);
    assert!(resource_switch_ms < 200.0);
    assert!(single_resource_save_ms < 300.0);
    assert!(timeline_feedback_ms < 100.0);
    assert!(filtered_graph_ms < 1_000.0);

    println!(
        "STORYFORGE_PERF_JSON:{}",
        serde_json::json!({
            "schemaVersion": 1,
            "fixture": {
                "chapters": 1_000,
                "scenes": 10_000,
                "resources": 5_000,
                "eventsAndStates": 50_000,
                "mentions": 200_000,
                "indexedRecords": index.stats().record_count
            },
            "metricsMs": {
                "projectInteractive": project_interactive_ms,
                "resourceSwitch": resource_switch_ms,
                "singleResourceSave": single_resource_save_ms,
                "timelineFeedback": timeline_feedback_ms,
                "filteredGraph": filtered_graph_ms
            },
            "thresholdsMs": {
                "projectInteractive": 2_500,
                "resourceSwitch": 200,
                "singleResourceSave": 300,
                "timelineFeedback": 100,
                "filteredGraph": 1_000
            }
        })
    );
}
