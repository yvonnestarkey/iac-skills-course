# Static file server for the prototype, plus a calendar feed host.
#
#   ruby server.rb            # port 8765
#   PORT=9000 ruby server.rb
#
# The browser builds each student's .ics and PUTs it to /calendar/<token>.ics.
# Calendar apps subscribe to that same URL and re-fetch it periodically, so
# saving a study plan updates the subscribed calendar without re-importing.

require "webrick"
require "fileutils"

ROOT = File.expand_path(File.dirname(__FILE__))
CAL_DIR = File.join(ROOT, "calendars")
TOKEN = /\A[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}\z/

FileUtils.mkdir_p(CAL_DIR)

port = (ENV["PORT"] || 8765).to_i

server = WEBrick::HTTPServer.new(
  Port: port,
  DocumentRoot: ROOT,
  DoNotReverseLookup: true
)

# A plain servlet, because mount_proc only answers GET and POST — calendar
# clients also send HEAD, and stopping a feed uses DELETE.
class CalendarFeed < WEBrick::HTTPServlet::AbstractServlet
  def do_OPTIONS(_req, res)
    cors(res)
    res.status = 204
  end

  def do_GET(req, res)
    cors(res)
    token = token_for(req, res) or return
    path = File.join(CAL_DIR, "#{token}.ics")
    unless File.exist?(path)
      res.status = 404
      res["Content-Type"] = "text/plain"
      res.body = "No calendar published for this token yet"
      return
    end
    res.status = 200
    res["Content-Type"] = "text/calendar; charset=utf-8"
    # Subscribed clients must not be served a stale cached copy.
    res["Cache-Control"] = "no-cache, must-revalidate"
    res["Content-Disposition"] = %(inline; filename="#{token}.ics")
    res["Last-Modified"] = File.mtime(path).httpdate
    res.body = File.read(path)
  end
  alias do_HEAD do_GET

  def do_PUT(req, res)
    cors(res)
    token = token_for(req, res) or return
    body = req.body.to_s
    unless body.start_with?("BEGIN:VCALENDAR")
      res.status = 422
      res["Content-Type"] = "text/plain"
      res.body = "Body must be an iCalendar document"
      return
    end
    File.write(File.join(CAL_DIR, "#{token}.ics"), body)
    res.status = 200
    res["Content-Type"] = "application/json"
    res.body = %({"ok":true,"url":"/calendar/#{token}.ics","bytes":#{body.bytesize}})
  end
  alias do_POST do_PUT

  def do_DELETE(req, res)
    cors(res)
    token = token_for(req, res) or return
    path = File.join(CAL_DIR, "#{token}.ics")
    File.delete(path) if File.exist?(path)
    res.status = 200
    res["Content-Type"] = "application/json"
    res.body = %({"ok":true})
  end

  private

  def cors(res)
    res["Access-Control-Allow-Origin"] = "*"
    res["Access-Control-Allow-Methods"] = "GET, HEAD, PUT, POST, DELETE, OPTIONS"
    res["Access-Control-Allow-Headers"] = "Content-Type"
  end

  # Returns a safe token, or writes a 400 and returns nil.
  def token_for(req, res)
    token = req.path.sub(%r{\A/calendar/?}, "").sub(/\.ics\z/, "")
    return token if token.match?(TOKEN)

    res.status = 400
    res["Content-Type"] = "text/plain"
    res.body = "Invalid calendar token"
    nil
  end
end

server.mount "/calendar", CalendarFeed

%w[INT TERM].each { |sig| trap(sig) { server.shutdown } }

puts "Accounting Study Advice prototype on http://127.0.0.1:#{port}"
puts "Calendar feeds served from #{CAL_DIR}"
server.start
