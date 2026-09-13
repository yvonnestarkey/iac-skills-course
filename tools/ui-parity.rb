# Compares the class names the static prototype rendered with the ones the
# Next.js components render, so a port cannot silently drop a styled element.
ROOT = File.expand_path("..", __dir__)

def classes_from(text, attr)
  found = []
  text.scan(/#{attr}=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/m) do |double, tick, brace|
    raw = double || tick || brace
    # Drop template expressions such as ${...} and JSX {cond ? "a" : "b"} parts.
    raw = raw.gsub(/\$\{[^}]*\}/, " ")
    found.concat(raw.split(/\s+/))
  end
  found
end

def jsx_conditional_classes(text)
  # Class names that only appear inside a ternary in a className template.
  text.scan(/className=\{`([^`]*)`\}/m).flatten.join(" ").scan(/"([^"]*)"/).flatten
end

CLASS_LIKE = /\A[a-z][a-z0-9-]*\z/

prototype = File.read("#{ROOT}/prototype/app.js", encoding: "UTF-8")
old = classes_from(prototype, "class").grep(CLASS_LIKE).uniq

app = Dir.glob("#{ROOT}/{app,components}/**/*.tsx").map { |f| File.read(f, encoding: "UTF-8") }.join("\n")
new = (classes_from(app, "className") + jsx_conditional_classes(app)).grep(CLASS_LIKE).uniq

css = File.read("#{ROOT}/app/globals.css", encoding: "UTF-8").scan(/\.([A-Za-z][A-Za-z0-9_-]*)/).flatten.uniq

missing = old - new
puts "prototype classes: #{old.length} · next classes: #{new.length}"
if missing.empty?
  puts "every prototype class name is still rendered"
else
  puts "missing from the Next.js components:"
  missing.sort.each { |c| puts "  #{c}#{css.include?(c) ? ' (styled in globals.css)' : ''}" }
end

unstyled = new - css - old
puts "\nnew class names with no CSS rule: #{unstyled.empty? ? 'none' : unstyled.sort.join(', ')}"
