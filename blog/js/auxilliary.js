(function() {
	function loadCss(url) {
		var e = document.createElement("link");
		e.rel = "stylesheet";
		e.type = "text/css";
		e.href = url;
		document.getElementsByTagName("head")[0].appendChild(e);
	}

	function applySyntaxHighlighting() {
		var t = window.setInterval(function() {
			if (window.hljs) {
				window.clearInterval(t);
				hljs.initHighlighting();
				var list = document.getElementsByTagName("pre");
				for (var i = 0; i < list.length; i++) {
					var pre = list[i];
					if (pre.className.indexOf("prettyprint") != -1)
						window.hljs.highlightBlock(pre);
				}
			}
		}, 100);
	}

	function rewriteLinksToHttps() {
		window.setTimeout(function() {
			var links = document.getElementsByTagName("a");
			for (var i = 0; i < links.length; i++) {
				var link = links[i];
				var href = "" + link.getAttribute("href");
				if (href.indexOf("http://blog.georgovassilis.com") != -1) {
					href = href.replace("http:", "https:");
					link.setAttribute("href", href);
				}
			}
		}, 10);
	}

	// from here: http://www.quirksmode.org/dom/getElementsByTagNames.html

	function getElementsByTagNames(list, obj) {
		if (!obj)
			var obj = document;
		var tagNames = list.split(',');
		var resultArray = new Array();
		for (var i = 0; i < tagNames.length; i++) {
			var tags = obj.getElementsByTagName(tagNames[i]);
			for (var j = 0; j < tags.length; j++) {
				resultArray.push(tags[j]);
			}
		}
		var testNode = resultArray[0];
		if (!testNode)
			return [];
		if (testNode.sourceIndex) {
			resultArray.sort(function(a, b) {
				return a.sourceIndex - b.sourceIndex;
			});
		} else if (testNode.compareDocumentPosition) {
			resultArray.sort(function(a, b) {
				return 3 - (a.compareDocumentPosition(b) & 6);
			});
		}
		return resultArray;
	}

	function createTOC() {
		var blogBody = document.getElementById('main').getElementsByTagName(
				"article")[0];
		var y = document.getElementById("innertoc");
		var z = y.appendChild(document.createElement('div'));
		var toBeTOCced = getElementsByTagNames('h1,h2,h3,h4,h5', blogBody);
		if (toBeTOCced.length < 2)
			return false;

		for (var i = 0; i < toBeTOCced.length; i++) {
			var li = document.createElement('li');
			var tmp = document.createElement('a');
			li.appendChild(tmp);
			tmp.innerText = toBeTOCced[i].innerText;
			tmp.className = 'toclink h' + toBeTOCced[i].nodeName;
			z.appendChild(li);
			var headerId = toBeTOCced[i].id || 'link' + i;
			tmp.href = '#' + headerId;
			toBeTOCced[i].id = headerId;
		}
		return y;
	}

	function showTOC() {
		window.setTimeout(createTOC, 1);
	}

	loadCss("//cdnjs.cloudflare.com/ajax/libs/highlight.js/9.9.0/styles/default.min.css");
	loadCss("https://fonts.googleapis.com/css?family=Pangolin|Lato|Monserrat");
	applySyntaxHighlighting();
	rewriteLinksToHttps();
	showTOC();
})();

function renderLatestPosts(v) {
	var entries = v.feed.entry;
	var count = entries.length < 5 ? entries.length : 5;
	var e = document.getElementById("ggLatestPosts");
	var s = "";
	function findLink(post) {
		for (var i = 0; i < post.link.length; i++)
			if (post.link[i].rel == "alternate")
				return post.link[i];
	}
	function formatDate(date) {
		return "<time> | "
				+ (date.getDate() < 10 ? "0" : "")
				+ date.getDate()
				+ " "
				+ ([ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug",
						"Sep", "Oct", "Nov", "Dec" ][date.getMonth()]) + " "
				+ (1900 + date.getYear()) + "</time>";
	}

	for (var i = 0; i < count; i++) {
		var post = entries[i];
		var link = findLink(post);
		var thumbnail = "<div class=nothumbnail></div>";
		if (post.media$thumbnail) {
			var thumbnail = "<a class=thumbnail href='" + link.href
					+ "'><img src='" + post.media$thumbnail.url + "'/></a>";
		}
		var shortText = "" + post.summary.$t;
		if (shortText.length > 77) {
			shortText = shortText.substring(0, 77);
			shortText = shortText.substring(0, shortText.lastIndexOf(" "))
					+ "...";
		}
		var summary = "<a class=summary href='" + link.href + "'>" + shortText
				+ "</a>"
		var title = "<a class=posttitle href='" + link.href + "'>" + link.title
				+ "</a>";
		var publicationDate = formatDate(new Date(post.published.$t));

		var html = "<li class=latestpost>" + thumbnail + "<div class=text>"
				+ title + summary + publicationDate + "</div></li>";
		s += html;
	}
	e.innerHTML = s;
}