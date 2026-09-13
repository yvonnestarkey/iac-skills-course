# Static check: every named/default import from a local module must exist.
# Stands in for `tsc --noEmit` while there is no Node toolchain on the machine.
ROOT = File.expand_path("..", __dir__)

files = Dir.glob("#{ROOT}/{app,components,lib}/**/*.{ts,tsx}")

def exports_of(path)
  return nil unless File.exist?(path)
  src = File.read(path, encoding: "UTF-8")
  names = []
  src.scan(/^export\s+(?:async\s+)?(?:function|const|let|class|interface|type|enum)\s+([A-Za-z0-9_$]+)/) { |m| names << m[0] }
  src.scan(/^export\s*\{([^}]*)\}/m) do |m|
    m[0].split(",").each do |part|
      piece = part.strip
      next if piece.empty?
      names << (piece =~ /\bas\s+([A-Za-z0-9_$]+)/ ? $1 : piece.split(/\s+/).first)
    end
  end
  names << "default" if src =~ /^export\s+default/
  names
end

def resolve(spec, from)
  base =
    if spec.start_with?("@/")
      File.join(ROOT, spec.sub("@/", ""))
    elsif spec.start_with?(".")
      File.expand_path(spec, File.dirname(from))
    end
  return nil unless base
  ["#{base}.ts", "#{base}.tsx", "#{base}/index.ts", "#{base}/index.tsx"].find { |p| File.exist?(p) } || :missing
end

problems = []

files.each do |file|
  src = File.read(file, encoding: "UTF-8")
  src.scan(/import\s+(type\s+)?([^;]*?)\s+from\s+["']([^"']+)["']/m) do |_type, clause, spec|
    next unless spec.start_with?("@/", ".")
    target = resolve(spec, file)
    if target == :missing || target.nil?
      problems << "#{file.sub(ROOT + '/', '')}: cannot resolve '#{spec}'"
      next
    end
    available = exports_of(target)
    wanted = []
    clause = clause.strip
    if (braces = clause[/\{([^}]*)\}/m, 1])
      braces.split(",").each do |part|
        piece = part.strip.sub(/^type\s+/, "")
        next if piece.empty?
        wanted << piece.split(/\s+as\s+/).first.strip
      end
    end
    default_part = clause.sub(/\{[^}]*\}/m, "").split(",").map(&:strip).reject(&:empty?).first
    wanted << "default" if default_part && !default_part.start_with?("*")

    wanted.each do |name|
      unless available.include?(name)
        problems << "#{file.sub(ROOT + '/', '')}: '#{name}' is not exported by #{target.sub(ROOT + '/', '')}"
      end
    end
  end
end

puts "checked #{files.length} files"
if problems.empty?
  puts "all local imports resolve"
else
  puts problems.sort.join("\n")
  puts "#{problems.length} problem(s)"
end
