// Ported from: (test support for the community stories port - the vi.mock fakes of src/hooks/useStories.test.ts and
//              src/components/community/{StoriesBar.open,StoryViewer.ads,StoryViewer.likes}.test.tsx)
import 'package:anacan/features/community/data/community_backend.dart' show CRow;
import 'package:anacan/features/community_stories/data/stories_backend.dart';

export '../../community/support/community_fakes.dart';

class FakeStoryStorage implements StoryStorage {
  final List<(String, CRow)> inserts = [];
  final List<(String, List<String>)> removed = [];
  @override
  Future<void> insert(String table, CRow values) async => inserts.add((table, values));
  @override
  Future<void> remove(String bucket, List<String> paths) async => removed.add((bucket, paths));
}
