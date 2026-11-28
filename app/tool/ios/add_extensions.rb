#!/usr/bin/env ruby
# frozen_string_literal: true

# Keeps app/ios/Runner.xcodeproj in sync with docs/flutter/IOS_EXTENSIONS.md:
#   - app extension AnacanTimerWidgetExtExtension (home widgets + timer Live Activity), bundle
#     com.atlasoon.anacan.AnacanTimerWidgetExt, sources in app/ios/AnacanTimerWidgetExt/ (+ Runner's
#     AnacanTimerAttributes.swift; its AnacanTimerStopIntent.swift is also compiled into Runner, as in Capacitor),
#   - app extension AnacanNotificationService (push image attachments), bundle
#     com.atlasoon.anacan.AnacanNotificationService, sources in app/ios/AnacanNotificationService/,
#   both with the Capacitor build settings, versions from Flutter/Generated.xcconfig, embedded in Runner
#   ("Embed Foundation Extensions", before "Thin Binary") and built as Runner dependencies;
#   - every .swift file under app/ios/Runner/ in Runner's Sources phase;
#   - the remote Swift packages listed in app/ios/spm_packages.json
#     ({"packages": [{"url", "requirement", "products": [...], "target": "Runner"}]}).
# Idempotent: existing objects are found by name/path and only missing pieces or differing settings are written;
# the project is saved only when something changed. New object ids are deterministic (SHA-1 sequence).
#
#   ruby app/tool/ios/add_extensions.rb           apply
#   ruby app/tool/ios/add_extensions.rb --check   list what would change; exit 1 when the project is not in sync
#
# Needs the xcodeproj gem >= 1.27 (a CocoaPods dependency, present on Codemagic macOS images).

require 'digest'
require 'json'
require 'pathname'

begin
  require 'xcodeproj'
rescue LoadError
  abort 'add_extensions.rb: the xcodeproj gem is missing (gem install xcodeproj)'
end

MIN_XCODEPROJ = '1.27.0'
if Gem::Version.new(Xcodeproj::VERSION) < Gem::Version.new(MIN_XCODEPROJ)
  abort "add_extensions.rb: xcodeproj #{Xcodeproj::VERSION} is too old, need >= #{MIN_XCODEPROJ} (gem install xcodeproj)"
end

CHECK = ARGV.include?('--check')
IOS_DIR = File.expand_path('../../ios', __dir__)
PROJECT_PATH = File.join(IOS_DIR, 'Runner.xcodeproj')
SPM_JSON = File.join(IOS_DIR, 'spm_packages.json')
RUNNER = 'Runner'
GENERATED_XCCONFIG = 'Flutter/Generated.xcconfig'
EMBED_PHASE = 'Embed Foundation Extensions'
EMBED_SUBFOLDER_PLUGINS = '13'
O = Xcodeproj::Project::Object
CHANGES = []

# Settings of the Capacitor extension targets (ios/App/App.xcodeproj), except the versions: the extensions must carry
# the app's CFBundleShortVersionString / CFBundleVersion, so they come from Flutter's --build-name / --build-number.
COMMON_SETTINGS = {
  'CLANG_CXX_LANGUAGE_STANDARD' => 'gnu++20',
  'CLANG_ENABLE_MODULES' => 'YES',
  'CLANG_ENABLE_OBJC_WEAK' => 'YES',
  'CLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS' => 'YES',
  'CLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF' => 'YES',
  'CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER' => 'YES',
  'CODE_SIGN_STYLE' => 'Automatic',
  'CURRENT_PROJECT_VERSION' => '$(FLUTTER_BUILD_NUMBER)',
  'DEVELOPMENT_TEAM' => '8B6976J8H7',
  'ENABLE_USER_SCRIPT_SANDBOXING' => 'YES',
  'GCC_C_LANGUAGE_STANDARD' => 'gnu17',
  'GENERATE_INFOPLIST_FILE' => 'YES',
  'INFOPLIST_KEY_NSHumanReadableCopyright' => '',
  'IPHONEOS_DEPLOYMENT_TARGET' => '16.6',
  'LD_RUNPATH_SEARCH_PATHS' => ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks'],
  'MARKETING_VERSION' => '$(FLUTTER_BUILD_NAME)',
  'PRODUCT_NAME' => '$(TARGET_NAME)',
  'SKIP_INSTALL' => 'YES',
  'SUPPORTED_PLATFORMS' => 'iphoneos iphonesimulator',
  'SUPPORTS_MACCATALYST' => 'NO',
  'SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD' => 'NO',
  'SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD' => 'NO',
  'SWIFT_VERSION' => '5.0',
  'TARGETED_DEVICE_FAMILY' => '1'
}.freeze

DEBUG_SETTINGS = {
  'MTL_ENABLE_DEBUG_INFO' => 'INCLUDE_SOURCE',
  'SWIFT_ACTIVE_COMPILATION_CONDITIONS' => 'DEBUG $(inherited)',
  'SWIFT_OPTIMIZATION_LEVEL' => '-Onone'
}.freeze

EXTENSIONS = [
  {
    name: 'AnacanTimerWidgetExtExtension',
    dir: 'AnacanTimerWidgetExt',
    sources: %w[AnacanTimerWidgetBundle.swift AnacanHomeWidgets.swift AnacanTimerWidgetLiveActivity.swift
                AnacanTimerStopIntent.swift],
    also_in_runner: %w[AnacanTimerStopIntent.swift],
    from_runner: %w[AnacanTimerAttributes.swift],
    resources: %w[Assets.xcassets],
    localized: %w[Localizable.strings],
    other_files: %w[Info.plist AnacanTimerWidgetExtExtension.entitlements],
    settings: {
      'ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS' => 'YES',
      'ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME' => 'AccentColor',
      'ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME' => 'WidgetBackground',
      'CODE_SIGN_ENTITLEMENTS' => 'AnacanTimerWidgetExt/AnacanTimerWidgetExtExtension.entitlements',
      'INFOPLIST_FILE' => 'AnacanTimerWidgetExt/Info.plist',
      'INFOPLIST_KEY_CFBundleDisplayName' => 'AnacanTimerWidgetExt',
      'LOCALIZATION_PREFERS_STRING_CATALOGS' => 'YES',
      'MTL_FAST_MATH' => 'YES',
      'PRODUCT_BUNDLE_IDENTIFIER' => 'com.atlasoon.anacan.AnacanTimerWidgetExt',
      'STRING_CATALOG_GENERATE_SYMBOLS' => 'YES',
      'SWIFT_APPROACHABLE_CONCURRENCY' => 'YES',
      'SWIFT_EMIT_LOC_STRINGS' => 'YES',
      'SWIFT_UPCOMING_FEATURE_MEMBER_IMPORT_VISIBILITY' => 'YES'
    }
  },
  {
    name: 'AnacanNotificationService',
    dir: 'AnacanNotificationService',
    sources: %w[NotificationService.swift],
    also_in_runner: [],
    from_runner: [],
    resources: [],
    localized: [],
    other_files: %w[Info.plist],
    settings: {
      'INFOPLIST_FILE' => 'AnacanNotificationService/Info.plist',
      'INFOPLIST_KEY_CFBundleDisplayName' => 'AnacanNotificationService',
      'PRODUCT_BUNDLE_IDENTIFIER' => 'com.atlasoon.anacan.AnacanNotificationService'
    }
  }
].freeze

def change(message)
  CHANGES << message
end

def fail!(message)
  abort "add_extensions.rb: #{message}"
end

# New objects get ids from a fixed SHA-1 sequence instead of random ones, so the same input gives the same output.
def make_uuids_deterministic(project)
  counter = 0
  project.define_singleton_method(:generate_uuid) do
    uuid = nil
    loop do
      counter += 1
      uuid = Digest::SHA1.hexdigest("anacan-add-extensions:#{counter}").upcase[0, 24]
      break unless objects_by_uuid.key?(uuid)
    end
    uuid
  end
end

def absolute_path(ref)
  ref.real_path.cleanpath.to_s
rescue StandardError
  nil
end

def find_file_by_absolute_path(project, path)
  project.files.find { |f| absolute_path(f) == path }
end

def ensure_group(project, parent, path)
  group = parent.children.find { |c| c.isa == 'PBXGroup' && c.path == path }
  return group if group

  group = project.new(O::PBXGroup)
  group.path = path
  group.source_tree = '<group>'
  parent.children << group
  change("group #{path}")
  group
end

def ensure_file_ref(group, name)
  ref = group.files.find { |f| f.path == name }
  return ref if ref

  ref = group.new_reference(name)
  change("file reference #{group.path}/#{name}")
  ref
end

def ensure_variant_group(group, name, dir)
  variant = group.children.find { |c| c.isa == 'PBXVariantGroup' && c.name == name }
  unless variant
    variant = group.new_variant_group(name)
    change("variant group #{group.path}/#{name}")
  end
  langs = Dir.children(dir).select { |d| d.end_with?('.lproj') && File.file?(File.join(dir, d, name)) }
             .map { |d| d.delete_suffix('.lproj') }.sort
  fail!("no <lang>.lproj/#{name} in #{dir}") if langs.empty?
  langs.each do |lang|
    path = "#{lang}.lproj/#{name}"
    next if variant.children.any? { |c| c.path == path }

    ref = variant.new_reference(path)
    ref.name = lang
    change("#{name} variant #{lang}")
  end
  variant
end

def ensure_in_phase(phase, ref, label)
  existing = phase.files.find { |bf| bf.file_ref == ref }
  return existing if existing

  change(label)
  phase.add_file_reference(ref)
end

def ensure_settings(cfg, wanted, label)
  wanted.each do |key, value|
    next if cfg.build_settings[key] == value

    cfg.build_settings[key] = value.dup
    change("#{label}/#{cfg.name}: #{key}")
  end
end

def ensure_extension_target(project, spec, generated)
  target = project.targets.find { |t| t.name == spec[:name] }
  unless target
    target = project.new(O::PBXNativeTarget)
    target.name = spec[:name]
    target.product_name = spec[:name]
    target.product_type = 'com.apple.product-type.app-extension'
    list = project.new(O::XCConfigurationList)
    list.default_configuration_is_visible = '0'
    list.default_configuration_name = 'Release'
    target.build_configuration_list = list
    product = project.new(O::PBXFileReference)
    product.path = "#{spec[:name]}.appex"
    product.explicit_file_type = 'wrapper.app-extension'
    product.include_in_index = '0'
    product.source_tree = 'BUILT_PRODUCTS_DIR'
    project.products_group.children << product
    target.product_reference = product
    [O::PBXSourcesBuildPhase, O::PBXFrameworksBuildPhase, O::PBXResourcesBuildPhase].each do |klass|
      target.build_phases << project.new(klass)
    end
    project.targets << target
    change("target #{spec[:name]}")
  end

  # Same configuration names as the project (Debug, Release, Profile), all based on Flutter/Generated.xcconfig for
  # FLUTTER_BUILD_NAME / FLUTTER_BUILD_NUMBER.
  list = target.build_configuration_list
  project.build_configurations.each do |project_cfg|
    cfg = list.build_configurations.find { |c| c.name == project_cfg.name }
    unless cfg
      cfg = project.new(O::XCBuildConfiguration)
      cfg.name = project_cfg.name
      cfg.build_settings = {}
      list.build_configurations << cfg
      change("#{spec[:name]}: configuration #{project_cfg.name}")
    end
    unless cfg.base_configuration_reference == generated
      cfg.base_configuration_reference = generated
      change("#{spec[:name]}/#{cfg.name}: base configuration #{GENERATED_XCCONFIG}")
    end
    wanted = COMMON_SETTINGS.merge(spec[:settings])
    wanted = wanted.merge(DEBUG_SETTINGS) if project_cfg.name == 'Debug'
    ensure_settings(cfg, wanted, spec[:name])
  end

  dir = File.join(IOS_DIR, spec[:dir])
  (spec[:sources] + spec[:resources] + spec[:other_files]).each do |name|
    fail!("missing #{spec[:dir]}/#{name}") unless File.exist?(File.join(dir, name))
  end
  group = ensure_group(project, project.main_group, spec[:dir])
  sources = target.source_build_phase
  spec[:sources].each do |name|
    ensure_in_phase(sources, ensure_file_ref(group, name), "#{spec[:name]} Sources: #{spec[:dir]}/#{name}")
  end
  spec[:from_runner].each do |name|
    ref = find_file_by_absolute_path(project, File.join(IOS_DIR, RUNNER, name))
    fail!("Runner/#{name} is not in the project") unless ref
    ensure_in_phase(sources, ref, "#{spec[:name]} Sources: Runner/#{name}")
  end
  resources = target.resources_build_phase
  spec[:resources].each do |name|
    ensure_in_phase(resources, ensure_file_ref(group, name), "#{spec[:name]} Resources: #{spec[:dir]}/#{name}")
  end
  spec[:localized].each do |name|
    ensure_in_phase(resources, ensure_variant_group(group, name, dir), "#{spec[:name]} Resources: #{name}")
  end
  spec[:other_files].each { |name| ensure_file_ref(group, name) }
  target.frameworks_build_phase
  [target, group]
end

def integrate_with_runner(project, runner, target, group, spec)
  spec[:also_in_runner].each do |name|
    ensure_in_phase(runner.source_build_phase, ensure_file_ref(group, name), "Runner Sources: #{spec[:dir]}/#{name}")
  end

  embed = runner.copy_files_build_phases.find { |p| p.dst_subfolder_spec.to_s == EMBED_SUBFOLDER_PLUGINS }
  unless embed
    embed = runner.new_copy_files_build_phase(EMBED_PHASE)
    embed.dst_subfolder_spec = EMBED_SUBFOLDER_PLUGINS
    embed.dst_path = ''
    change("Runner: #{EMBED_PHASE} phase")
  end
  # Flutter's "Thin Binary" script must run after the extensions are embedded ("Cycle inside Runner" otherwise).
  phases = runner.build_phases
  thin = phases.find { |p| p.respond_to?(:name) && p.name == 'Thin Binary' }
  if thin && phases.index(embed) > phases.index(thin)
    phases.delete(embed)
    phases.insert(phases.index(thin), embed)
    change("Runner: #{EMBED_PHASE} moved before Thin Binary")
  end
  unless embed.files_references.include?(target.product_reference)
    build_file = embed.add_file_reference(target.product_reference)
    build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
    change("Runner: embed #{target.product_reference.path}")
  end

  unless runner.dependencies.any? { |d| d.target == target }
    runner.add_dependency(target)
    change("Runner: dependency on #{target.name}")
  end

  attributes = project.root_object.attributes
  target_attributes = (attributes['TargetAttributes'] ||= {})
  return if target_attributes.key?(target.uuid)

  target_attributes[target.uuid] = { 'CreatedOnToolsVersion' => '15.0' }
  change("TargetAttributes #{target.name}")
end

# Swift files other changes drop into app/ios/Runner/ (subfolders become groups) compile without an Xcode edit.
def sync_runner_sources(project, runner)
  runner_group = project.main_group.children.find { |c| c.isa == 'PBXGroup' && c.path == RUNNER }
  fail!('Runner group missing') unless runner_group
  phase = runner.source_build_phase
  compiled = phase.files_references.compact.map { |r| absolute_path(r) }.compact
  base = Pathname.new(File.join(IOS_DIR, RUNNER))
  Dir.glob(File.join(base.to_s, '**', '*.swift')).sort.each do |file|
    path = Pathname.new(file).cleanpath
    next if compiled.include?(path.to_s)

    rel = path.relative_path_from(base)
    group = runner_group
    rel.dirname.each_filename { |segment| group = ensure_group(project, group, segment) } unless rel.dirname.to_s == '.'
    ref = ensure_file_ref(group, rel.basename.to_s)
    phase.add_file_reference(ref)
    change("Runner Sources: Runner/#{rel}")
  end
end

def normalize_url(url)
  url.to_s.strip.downcase.sub(%r{/+\z}, '').sub(/\.git\z/, '')
end

# "1.7.2" / "exact:1.7.2", "from:4.9.0" / "upToNextMajor:4.9.0", "upToNextMinor:4.9.0", "branch:main",
# "revision:<sha>", or Xcode's own hash ({"kind": "upToNextMajorVersion", "minimumVersion": "18.0.0"}).
def package_requirement(requirement, url)
  case requirement
  when Hash
    req = requirement.to_h { |k, v| [k.to_s, v.to_s] }
    fail!("#{url}: requirement needs a \"kind\"") if req['kind'].to_s.empty?
    req
  when String
    kind, value = requirement.include?(':') ? requirement.split(':', 2) : ['exact', requirement]
    fail!("#{url}: empty requirement value") if value.to_s.strip.empty?
    value = value.strip
    case kind
    when 'exact' then { 'kind' => 'exactVersion', 'version' => value }
    when 'from', 'upToNextMajor' then { 'kind' => 'upToNextMajorVersion', 'minimumVersion' => value }
    when 'upToNextMinor' then { 'kind' => 'upToNextMinorVersion', 'minimumVersion' => value }
    when 'branch' then { 'kind' => 'branch', 'branch' => value }
    when 'revision' then { 'kind' => 'revision', 'revision' => value }
    else fail!("#{url}: unknown requirement kind #{kind}")
    end
  else
    fail!("#{url}: requirement must be a string or an object")
  end
end

def sync_packages(project)
  return unless File.exist?(SPM_JSON)

  data = JSON.parse(File.read(SPM_JSON))
  items = data.is_a?(Array) ? data : Array(data['packages'])
  items.each do |item|
    fail!("spm_packages.json: every entry must be an object (#{item.inspect})") unless item.is_a?(Hash)
    url = item['url'].to_s.strip
    products = Array(item['products']).map(&:to_s).reject(&:empty?)
    target_name = (item['target'] || RUNNER).to_s
    fail!("spm_packages.json: entry without url (#{item.inspect})") if url.empty?
    fail!("spm_packages.json: #{url} lists no products") if products.empty?
    target = project.targets.find { |t| t.name == target_name }
    fail!("spm_packages.json: #{url}: no target #{target_name}") unless target
    wanted = package_requirement(item['requirement'], url)

    package = project.root_object.package_references.find do |r|
      r.isa == 'XCRemoteSwiftPackageReference' && normalize_url(r.repositoryURL) == normalize_url(url)
    end
    unless package
      package = project.new(O::XCRemoteSwiftPackageReference)
      package.repositoryURL = url
      package.requirement = wanted
      project.root_object.package_references << package
      change("Swift package #{url}")
    end
    unless package.requirement == wanted
      package.requirement = wanted
      change("Swift package #{url}: requirement #{wanted.values.join(' ')}")
    end

    frameworks = target.frameworks_build_phase
    products.each do |product|
      dependency = target.package_product_dependencies.find { |d| d.product_name == product && d.package == package }
      unless dependency
        dependency = project.new(O::XCSwiftPackageProductDependency)
        dependency.package = package
        dependency.product_name = product
        target.package_product_dependencies << dependency
        change("#{target_name}: package product #{product}")
      end
      next if frameworks.files.any? { |bf| bf.product_ref == dependency }

      build_file = project.new(O::PBXBuildFile)
      build_file.product_ref = dependency
      frameworks.files << build_file
      change("#{target_name} Frameworks: #{product}")
    end
  end
end

project = Xcodeproj::Project.open(PROJECT_PATH)
make_uuids_deterministic(project)
runner = project.targets.find { |t| t.name == RUNNER }
fail!('Runner target missing') unless runner
generated = project.files.find { |f| f.path == GENERATED_XCCONFIG }
fail!("#{GENERATED_XCCONFIG} file reference missing") unless generated

EXTENSIONS.each do |spec|
  target, group = ensure_extension_target(project, spec, generated)
  integrate_with_runner(project, runner, target, group, spec)
end
sync_runner_sources(project, runner)
sync_packages(project)

if CHANGES.empty?
  puts 'add_extensions.rb: Runner.xcodeproj is in sync'
  exit 0
end
CHANGES.each { |c| puts "  #{c}" }
if CHECK
  warn "add_extensions.rb --check: #{CHANGES.size} change(s) needed"
  exit 1
end
project.save
puts "add_extensions.rb: Runner.xcodeproj saved (#{CHANGES.size} change(s))"
