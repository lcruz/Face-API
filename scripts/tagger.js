/*!
 * Face.com Tagging Widget v1.2.1 (alpha) 
 * http://face.com/
 *
 * Copyright 2010, 
 * Written By Lior Ben-Kereth
 *  
 * Date: Sun May 23 19:34:57 2010 +0300
 *
 * v1.1.0 - Now supports both old and new Facebook Javascript SDK
 * v1.2.0 - Add detect_face flag - only get tags from DB without face detection + add callback option tagSaved
 * v1.2.1 - Filter low confidence tags, and improve tags position 
 */
function Face_Tagger(_FaceClientAPI)
{
	var FaceClientAPI = _FaceClientAPI;
	var design = 'default';
	var _tempTag = null;
	
	var DEBUG = false;
	var ADMIN_MODE = isAdminMode();
	var ADMIN_PASSWORD = '';
	
	var TAG_PADDING = 1.3;
	var FACE_CONFIDENCE_THRESHOLD = 20;

	var EXCEPTION_MISSING_ARGUMENTS		= 'Argument {0} for function {1} is missing or invalid';
	var TAG_TEXT_UNKNOWN				= 'Tag me';
	var TAG_TEXT_GROUP					= 'Person {0}';
	var TXT_FB_STREAM_PROMPT			= 'Share these tags with your friends on Facebook:';
	var TXT_FB_STREAM_CAPTION			= '{*actor*} just tagged this photo using face.com\'s tagger widget';
	var TXT_IN_THIS_PHOTO				= 'In this photo';
	
	var LOADING_FETCHING_TAGS			= 1;
	var LOADING_FACEBOOK_USERS			= 2;
	var LOADING_TWITTER_USERS			= 3;
	var TXT_LOADING = [];
		TXT_LOADING[LOADING_FETCHING_TAGS]			= "Fetching tags...";
		TXT_LOADING[LOADING_FACEBOOK_USERS]			= "Fetching Facebook friends...";
		TXT_LOADING[LOADING_TWITTER_USERS]			= "Fetching twitter friends...";
	
	var STATUS_FAIL = 'failed';
	
	var TIMEOUT_TWITTER = 20000;
	
	var MIN_TAG_SIZE = 90;
	var DEFAULT_TAG_SIZE = 110;
	var AUTOCOMPLETE_MAX_USERS = 7;
	var SUPPORTED_DESIGNS = { 'default': true, 'round': true, 'arch': true, 'wood': true, 'facebook': true, 'zeedevil': true };
	
	var aImages = new Array();
	var aImagesUsers = new Array();
	var aImagesACUsers = new Array();
	
	var m_twitterUser = '';
	var m_twitterToken = '';
	var m_twitterTokenSecret = '';
	var m_twitterScreenName = '';
	
	var m_fbUser = '';
	var m_fbSession = '';
	
	var m_demoMode = '';
	var refTagClick = null;
	var refCallback = null;
	
	var bReadOnly;
	var bManualTags;
	var bAddTagButton;
	var bNamesAsLinks;
	var bResizable;
	var bShowTagsList;
	var bFadeTags;
	var bTagsVisible;
	var bShowLoading;
	var bDetectFaces;
	
	var m_imgTagName = null;
	
	var error_handler = handleError;
	var tagSaved_handler = tagSavedHandler;
	
	var dummyTag = $('<div class="f_tag f_tag_trans"><div class="f_tag_caption"</div></div>');
	
	var attributesArray;
	
	var onAttributesReady;
	
	//-------------------
	// Public Functions
	//-------------------
	this.load = load;
	this.setDesign = setDesign;
	this.clear = clear;	
	
	function getattributesArray()
	{
		return attributesArray;
	}
	
	// Start all the tagger logic (get and draw tags, add manual tagging)
	function load(oImg, options,onAttributedHandler)
	{
		onAttributesReady = onAttributedHandler;
		if (typeof jQuery == 'undefined')
			loadJavaScript("http://ajax.googleapis.com/ajax/libs/jquery/1.4.2/jquery.js");
		
		if (typeof jQuery.ui == 'undefined')
			loadJavaScript("http://ajax.googleapis.com/ajax/libs/jqueryui/1.8.1/jquery-ui.min.js");
		
		this.clear();
		
		m_imgTagName = oImg;
		
		var aImgs = $(oImg);
						
		if (aImgs.length == 0)
			return false;

		if (options != undefined)
		{	
			refCallback = (options.success == undefined || typeof options.success != "function")? undefined : options.success;
			refTagClick = options.tagClick;
			
			bReadOnly		= (typeof options.readonly != "boolean")? false : options.readonly;
			bManualTags		= (typeof options.click_add_tag != "boolean")? false : options.click_add_tag;
			bAddTagButton	= (typeof options.add_tag_button != "boolean")? false : options.add_tag_button;
			bNamesAsLinks	= (typeof options.names_as_links != "boolean")? false : options.names_as_links;
			bResizable		= (typeof options.resizable != "boolean")? false : options.resizable;
			bShowTagsList	= (typeof options.tags_list != "boolean")? false : options.tags_list;
			bFadeTags		= (typeof options.fade != "boolean")? false : options.fade;
			bTagsVisible	= (typeof options.tags_visible != "boolean")? true : options.tags_visible;
			bShowLoading	= (typeof options.show_loading != "boolean")? true : options.show_loading;
			bDetectFaces	= (typeof options.detect_faces != "boolean")? true : options.detect_faces;
			m_demoMode		= (typeof options.demo_mode != "boolean")? false : options.demo_mode;
			
			if (typeof options.design != 'undefined')
				this.setDesign(options.design);
			
			error_handler = (typeof options.error != "function")? handleError : options.error;
			tagSaved_handler = (typeof options.tagSaved != "function")? tagSavedHandler : options.tagSaved;			
			DEBUG = (options.debug == undefined)? false : options.debug;
		}
		
		try
		{
			var srcs = '';
			
			addTagsCss();
			
			aImgs.each(function(){
				var img = $(this);
				var src = img.attr('src');
				
				//get full src
				var imageObject = new Image();
				imageObject.src = src;
				src = imageObject.src;
				img.attr('src', src);
				
				aImages[src] = img;
				aImagesUsers[src] = [];
				aImagesACUsers[src] = AUTOCOMPLETE_MAX_USERS;
				
				srcs += src + ',';
	
				if (empty(img.attr('id')))
					img.attr('id', 'f_' + Math.round(Math.random()*1000000000));
				
				var wrapperId = 'fr_' + img.attr('id');
				var oWrapper = $('<div id="' + wrapperId + '" class="f_wrapper" style="display: inline-block; margin: 0; padding: 0; float: none; position: relative; border: 0; background: none;"></div>');
				
				img.wrap(oWrapper);
				oWrapper = $("#" + wrapperId);
				
				if (ADMIN_MODE)
					drawAdminMode(oWrapper);
				
				if (bShowLoading)
					showLoading(oWrapper, LOADING_FETCHING_TAGS);

				addLogo(img);
	
				if (bManualTags)
					addManualTagging(img, bResizable);
				
				if (bAddTagButton)
					addAddTagButton(oWrapper, bResizable);
				
				if (options != undefined)
				{
					aImagesACUsers[src] = (options.max_ac_users != undefined)? options.max_ac_users : AUTOCOMPLETE_MAX_USERS;
					
					if (options.users != undefined)
					{
						$.each(options.users, function(i, user){
							if (validateUser(user))
							{
								if (empty(user.searchBy))
									user.searchBy = user.first_name + " " + user.last_name;
								if (empty(user.format))
									user.format = defaultUserFormat;
								
								aImagesUsers[src]["u" + user.uid] = user;
							}
						});
					}
					
	
					if (bShowLoading && !empty(options.twitter_oauth_user) && !empty(options.twitter_oauth_token) && !empty(options.twitter_oauth_secret))
						showLoading(document.body, LOADING_TWITTER_USERS);
				}
			});
			
			if (!empty(options.twitter_oauth_user) && !empty(options.twitter_oauth_token) && !empty(options.twitter_oauth_secret))
				setupTwitter(options.twitter_oauth_user, options.twitter_oauth_token, options.twitter_oauth_secret);
			
			setupFacebook(bShowLoading && options.facebook);
			
			if (srcs != '')
			{					
				srcs = srcs.substring(0, srcs.length - 1);
				
				if (bDetectFaces)
				{												
					FaceClientAPI.faces_detect(srcs, onDetectionComplete);				
					return true;
				}
				else
				{
					FaceClientAPI.tags_get({urls: srcs,
											limit: 1000}
											, onDetectionComplete);				
					return true;
				}
			}
			else
			{
				return false;
			}
		}
		catch(ex)
		{						
			error_handler(ex);
		}
	}
	
	function onDetectionComplete(url, data)
	{
		if (!validateAPIResponse(data))
		{						
			dbug("warn", "Response from API isn't valid");						
			removeLoading(document.body, LOADING_FETCHING_TAGS);												
			error_handler(data);
			return false;
		}
		
		$.each(data.photos, function(i, item){
			dbug("log", "proccesing photo: " + item.url);
			var img = aImages[item.url];
			
			if (img != undefined)
			{
				if (img.attr("complete") || img[0].complete)
				{
					dbug("log", "image was loaded, adding " + item.tags.length + " tags");
					var oWrapper = drawTagsOnImage(img, item.tags, refTagClick, bReadOnly, bNamesAsLinks, bShowTagsList, bTagsVisible, bFadeTags);
					oWrapper.height(img[0].offsetHeight);
					oWrapper.width(img[0].offsetWidth);
				}
				else
				{
					img.bind("load", function(e)
					{
						dbug("log", "image finished loading, adding " + item.tags.length + " tags");
						var oWrapper = drawTagsOnImage(img, item.tags, refTagClick, bReadOnly, bNamesAsLinks, bShowTagsList, bTagsVisible, bFadeTags);
						oWrapper.height(img[0].offsetHeight);
						oWrapper.width(img[0].offsetWidth);
					});
				}
			}
		});
		
		removeLoading(document.body, LOADING_FETCHING_TAGS);
		
		if (refCallback != undefined) 
			refCallback(oImg, data);
	}
	
	function clear()	
	{		
		if (m_imgTagName != null)
		{
			var image = $(m_imgTagName);
			
			$('.f_wrapper').parent().append(image);
			$('.f_wrapper').remove();			
		}		
	}

	// Set the tags design
	function setDesign(_design)
	{
		if (_design == undefined)
			throw EXCEPTION_MISSING_ARGUMENTS.replace('{0}', 'design').replace('{0}', 'setDesign');
		
		if (SUPPORTED_DESIGNS[_design] != true)
			_design = 'default';
		
		design = _design;
		
		dbug("log", "Setting design to " + design);
	}
	

	//-------------------
	// Private Functions
	//-------------------
	function changeEditMode(oWrapper, bEditable)
	{
		if (bEditable)
			attachEventsToWrapper(oWrapper);
		else
			removeEventsFromWrapper(oWrapper);
	}
	
	function tagChangeEditMode(oTag, bEditable)
	{
		if (bEditable)
		{
			oTag.find(".f_tag_caption").attr("title", "");
			oTag.removeClass('f_tag_readonly');
			
			if (!(oTag.attr("manual") == 'false' && oTag.attr("confirmed") == 'false'))
				oTag.append('<span class="f_tag_remove">X</span>');
			
			attachEventsToWrapper(oTag);
		}
		else
		{
			oTag.find(".f_tag_caption").each(function(){ $(this).attr("title", $(this).text()); });
			oTag.addClass('f_tag_readonly');
			oTag.find('.f_tag_remove').remove();
			
			removeEventsFromWrapper(oTag);
		}
	}
	
	function drawAdminMode(oWrapper)
	{
		var oLogin = $('<div style="position: absolute; bottom: 2px; left: 2px; cursor: pointer; font-size: 11px; font-weight: bold; background: #000; border: 1px solid #fff; padding: 2px 4px; color: #fff;">Login as Admin</div>');
		oLogin.click(function(){
			var sPassword = prompt("Please enter your administrator password:");
			if (!empty(sPassword))
			{
				FaceClientAPI.general_authenticate(sPassword, function(data){
					if (data.authenticated)
					{
						ADMIN_PASSWORD = sPassword;
						oLogin.html("").append("LOGGED IN").css("cursor", "default").unbind("click");
						changeEditMode(oWrapper, true);
					}
					else
					{
						error_handler("Password Incorrect");
					}
				});
			}
			return false;
		});
		oWrapper.append(oLogin);
	}
	
	function showLoading(oWrapper, loadingType)
	{
		oWrapper = $(oWrapper);
		
		var oMainLoading = oWrapper.find(".f_tag_m_loading");
		if (oMainLoading.length == 0)
		{
			oMainLoading = $('<div class="f_tag_m_loading"></div>');
			oWrapper.append(oMainLoading);
		}

		var oLoading = $('<div class="f_tag_loading f_tag_loading_' + loadingType + '">' + TXT_LOADING[loadingType] + '</div>');
		oMainLoading.append(oLoading);
		
		pulseLoading(oLoading);
	}
	
	function removeLoading(oWrapper, loadingType)
	{
		oWrapper = $(oWrapper);
		oWrapper.find(".f_tag_loading_" + loadingType).remove();
		var oMainLoading = oWrapper.find(".f_tag_m_loading");
		if (oMainLoading.children().length == 0)
			oMainLoading.remove();
	}
	
	// Create the flashing effect of the "Fetching tags" element
	function pulseLoading(oLoading)
	{
		if (oLoading.length > 0)
			oLoading.animate({backgroundColor: "transparent"}, 300).animate({backgroundColor: "#f00"}, 300, '', function(){ pulseLoading($(this)); });
	}

    function addLogo(img)
    {
        var oWrapper = $('#fr_' + img.attr('id'));
        var logo = $('<img class="f_attribution" src="http://static.face.com/badges/badge_4_light_bg.png" border="0" alt="Powered by face.com"/>');
        oWrapper.append(logo);
    }
	
	// Add the manual tagging possibility to an image
	function addManualTagging(img, bResizable)
	{
		var oWrapper = $('#fr_' + img.attr('id'));
		oWrapper.css('cursor', 'crosshair');
		
		if (oWrapper.parent().attr("href") != "")
			oWrapper.parent().click(function(e){ return false; });
		
		img.click(function(e){
			addManualTag($('#fr_' + $(this).attr('id')), (e.pageX - $(this).offset().left) / $(this).width() * 100, (e.pageY - $(this).offset().top) / $(this).height() * 100, bResizable);
			return false;
		});
	}
	
	function addAddTagButton(oWrapper, bResizable)
	{
		var btn = $('<div class="f_add_tag">New Tag</div>');
		btn.click(function(){
			addManualTag(oWrapper, null, null, bResizable);
			return false;
		});
		oWrapper.append(btn);
	}
	
	function addManualTag(oWrapper, x, y, bResizable)
	{
		var img = $('#' + oWrapper.attr('id').replace("fr_", ""));
		
		var offset = img.offset();
		var width = img.width();
		var height = img.height();
		
		dbug("log", oWrapper.attr("id") + ": Adding a manual tag");
		
		if (_tempTag != null)
		{
			removeTag(_tempTag, false);
			_tempTag = null;
		}
		
		var sizeX = DEFAULT_TAG_SIZE / width * 100;
		var sizeY = DEFAULT_TAG_SIZE / height * 100;
		
		if (DEFAULT_TAG_SIZE > width || DEFAULT_TAG_SIZE > height)
		{
			var size = Math.min(width, height);
			sizeX = (size-30) / width * 100;
			sizeY = (size-30) / height * 100;
		}
		
		if (empty(x)) x = 50;
		if (empty(y)) y = 50;
		
		_tempTag = drawTag(oWrapper, '', '', img, -1, -1, x, y, sizeX, sizeY, null, false, true, true, bResizable, false);
		
		attachEventsToWrapper(oWrapper);
		
		renameTag(null, $(_tempTag.find(".f_tag_caption")[0]), true);
	}
	
	function createTagListContainer()
	{
		var oList = $('<div class="f_tags_list"><b>' + TXT_IN_THIS_PHOTO + ':</b></div>');
		oList.click(function(){ return false; });
		
		return oList;
	}
	
	// Given an image and an array of tags, draws the tags on the image
	function drawTagsOnImage(img, aTags, refTagClick, bReadOnly, bNamesAsLinks, bShowTagsList, bTagsVisible, bFadeTags)
	{
		var wrapperId = 'fr_' + img.attr('id');
		var oWrapper = $('#' + wrapperId);
		
		if (aTags != undefined && aTags.length > 0)
		{	
			var oList = createTagListContainer();
			
			attributesArray =new Array();
			$.each(aTags, function(i, item){
				
				// Check tag face confidence - ignore if its less than 50
				var skipTag = false;
				if (typeof item.attributes != "undefined")
				{
					attributesArray.push(item.attributes);
					for(var aName in item.attributes) 
					{
						
						var aValue = item.attributes[aName];						
						
						if (aName == "face" && aValue.confidence <= FACE_CONFIDENCE_THRESHOLD)
						{
							skipTag = true;
							break;
						}
					}
				}
				else
				{
					skiptTag = true;
				}		
				
				if (!skipTag)
				{
				
					var name = !empty(item.label)? item.label : (item.uids.length > 0 && !empty(item.uids[0].uid) ? item.uids[0].uid : TAG_TEXT_UNKNOWN);
					
					if (!empty(item.gid))
						name = name.replace('{0}', item.gid);
					else
						name = name.replace(' {0}', '');
					
					dbug("log", wrapperId + ": Drawing tag (confirmed: " + item.confirmed + ", manual: " + item.manual + ") '" + name + "': (" + item.center.x + "," + item.center.y + ") [width: " + item.width + ", height: " + item.height + "]");
					
					var oTag = drawTag('#' + wrapperId, item.tid, name, img, item.confirmed, item.manual, item.center.x, item.center.y, item.width, item.height, refTagClick, bReadOnly, bNamesAsLinks, false, false, bFadeTags);
					
					oTag.attr("tagger_id", item.tagger_id);
					
					if (bFadeTags)
						window.setTimeout(function(){ oTag.fadeIn("fast"); }, 80*(i+1));
					
					if (!bTagsVisible)
					{
						oTag.addClass("f_tag_hidden")
							.hover(
									function(){
										oTag.removeClass("f_tag_hidden").addClass("f_tag_visible");
									},
									function(){
										if ($('#f_autocomplete').length == 0)
											oTag.removeClass("f_tag_visible").addClass("f_tag_hidden");
									}
							);
					}
					
					if (!empty(item.label))
					{
						var oTagListItem = getTagListItem(oTag, name, bTagsVisible);
						oTagListItem.appendTo(oList);
							
						oList.append("<span>, </span>");
					}		
													
					tagChangeEditMode(oTag, !bReadOnly);
					//tagChangeEditMode(oTag, (item.tagger_id == FaceClientAPI.getApiKey() || item.tagger_id == null || item.tagger_id == m_fbUser || item.tagger_id == (m_twitterScreenName+"@twitter.com")) && !bReadOnly);
				}
			});
			
			if (bShowTagsList && oList.find("span").length > 0)
			{
				oWrapper.append(oList);
				oList.css("bottom", -oList.height() + "px");
				oList.find("span:last-child").remove();
			}
			
			oWrapper.find('.f_tag').addClass('f_tag_saved');
			
			dbug("log", wrapperId + ": Done drawing tags");
		}
		
		removeLoading(oWrapper, LOADING_FETCHING_TAGS);
		
		onAttributesReady(attributesArray);
		
		return oWrapper;
	}
	
	function getTagListItem(oTag, name, bTagsVisible)
	{
		return $('<span class="f_tag_name" id="' + oTag.attr("tid") + '_name">' + name + '</span>')
				.hover(
					function(){
						if (bTagsVisible)
							oTag.addClass("f_tag_trans_hover");
						else
							oTag.removeClass("f_tag_hidden").addClass("f_tag_visible");								
					},
					function(){
						if (bTagsVisible)
							oTag.removeClass("f_tag_trans_hover");
						else
							if ($('#f_autocomplete').length == 0)
								oTag.removeClass("f_tag_visible").addClass("f_tag_hidden");
					});
	}
	
	function showTag(oTag)
	{
		oTag.show();
	}
	function hideTag(oTag)
	{
		oTag.hide();
	}
	
	// Iterate through the tags in the wrapper and attach the save, remove and rename events
	function attachEventsToWrapper(oTagOrWrapper)
	{
		oTagOrWrapper.find('.f_tag_caption').unbind("click").click(function(e){ renameTag(e, $(this), false); return false; });
		oTagOrWrapper.find('.f_tag_confirm').unbind("click").click(function(e){ saveTag(e, $(this).parent(), true); return false; });
		oTagOrWrapper.find('.f_tag_remove').unbind("click").click(function(e){ removeTag($(this).parent(), true); return false; });
	}
	
	function removeEventsFromWrapper(oTagOrWrapper)
	{
		oTagOrWrapper.find('.f_tag_caption').unbind("click");
		oTagOrWrapper.find('.f_tag_confirm').unbind("click");
		oTagOrWrapper.find('.f_tag_remove').unbind("click");
	}
	
	function extractNumberFromPixelSize(pixelSize)
	{
		var result = 0;
		if (!empty(pixelSize))
			result = pixelSize.substring(0, pixelSize.length - 2);
		
		return result;
	}
	
	// Draw tag HTML- If refTagClick is passed- bind the event to the tag click
	function drawTag(oWrapper, sTagId, sFullName, oImage, iConfirmed, iManual, _iX, _iY, _iWidth, _iHeight, refTagClick, bReadOnly, bNamesAsLinks, bNewTag, bResizable, bFadeTags)
	{
		oWrapper = $(oWrapper);
		
		var borderWidth = extractNumberFromPixelSize(dummyTag.css('border-left-width'));				
		var captionHeight= extractNumberFromPixelSize(dummyTag.find('.f_tag_caption').css('line-height'));					
		
		sFullName = (empty(sFullName))? TAG_TEXT_UNKNOWN : sFullName;
		var sName;
		if (sFullName != TAG_TEXT_UNKNOWN )
			 sName = (sFullName.split(" "))[0];
		else
			sName = sFullName;
		
		var wHeight		= oImage.height();
		var wWidth		= oImage.width();			
		
		var ioX			= _iX * wWidth / 100;
		var ioY			= _iY * wHeight / 100;
		var iWidth		= _iWidth * TAG_PADDING * wWidth / 100;
		var iHeight		= _iHeight * TAG_PADDING * wHeight / 100;
		
		var iX			= ioX - (iWidth/2) - borderWidth;
		var iY			= ioY - (iHeight/2) - borderWidth - (captionHeight/2);
		
		if (iX < 0) iX = 0;
		if (iY < 0) iY = 0;
		
		if (iX+iWidth > wWidth) iX = wWidth - iWidth; 
		if (iY+iHeight > wHeight) iY = wHeight - iHeight;
		
		var oTag = $('<div id="f_tag_' + iY + '_' + iX + '" class="f_tag f_tag_trans ' + ((bNewTag)? "f_tag_new" : "") + '" style="top: ' + Math.round(iY) + 'px; left: ' + Math.round(iX) + 'px; width: ' + Math.round(iWidth) + 'px; height: ' + Math.round(iHeight) + 'px;">' +
						'<div class="f_tag_caption" title="' + sFullName.replace(/"/g,'&quot;') + '"><span>' + sName.replace(/</g, "&lt;") + '</span></div>' +
					'</div>');
		
		if (bFadeTags)
			oTag.hide();
		
		oWrapper.append(oTag);
				
		if (design == 'zeedevil')
		{
			var oDevil = $('<img src="http://evyatarface.vizilabs.com/devil.png" alt="' + sName.replace(/"/g, '') + '" style="margin-top: -' + oTag.height()/9 + 'px; opacity: .9; filter: alpha(opacity=70); margin-left: -5%; width: 110%; height: 110%;" />');
			oTag.append(oDevil);
		}
		
		oTag.attr("tid", sTagId).
			attr('fx', _iX).
			attr('fy', _iY).
			attr('fwidth', _iWidth).
			attr('fheight', _iHeight).
			attr('fsrc', oImage.attr('src')).
			attr('manual', iManual).
			attr('confirmed', iConfirmed);
		
		if (bNewTag)
		{	
			if (bResizable)
			{
				dbug("log", oWrapper.attr('id') + ": Applying resizable");
				
				oTag.resizable({
								containment: 'parent',
								aspectRatio: true,
								handles: 'nw, ne, se, sw',
								minHeight: MIN_TAG_SIZE,
								minWidth: MIN_TAG_SIZE,
								stop: function(event, ui){
									var oTag = $(this);
									oTag.attr('fwidth', (oTag.width()/TAG_PADDING)/wWidth*100).
										attr('fheight', (oTag.height()/TAG_PADDING)/wHeight*100);
								}
					});
				oTag.css('position', 'absolute');
			}
			
			dbug("log", oWrapper.attr('id') + ": Applying draggable");
			
			oTag.draggable({
							containment: 'parent',
							stop: function(event, ui){
								var oTag = $(this);
								
								y = this.offsetTop + oTag.height()/2;
								x = this.offsetLeft + oTag.width()/2;
								
								y = y/wHeight*100;
								x = x/wWidth*100;
								
								oTag.attr('fx', x).
									attr('fy', y);
							}
				});
		}
		
		if (!empty(refTagClick))
			oTag.click(function(){ refTagClick(this, oImage[0], sName, _iX, _iY, _iWidth, _iHeight); return false; });
		
		return oTag;
	}
	
	// Change the tag to Rename mode- add an input instead of text and attach key events to it
	function renameTag(e, oName, bNewTag)
	{
		oCaption = $($(oName.children()[0]));
		
		if (oCaption.find('input').length == 0)
		{
			var sName = oCaption.html();
									
			var input = $('<input type="text" value="' + sName.replace(/"/g, '') + '" ></input>');			
			
			oCaption.attr('oname', sName).
					 html(input).
					 //append(input).
					 find('input').
					 focus().
					 select().
					 keydown(function(e){						
						switch (e.keyCode)
						{												
							case 38: // UP
								pageAutoComplete(-1);
								break;
							case 40: // DOWN
								pageAutoComplete(1);
								break;
							case 13: // ENTER
								var uid = checkAutoComplete($(this));
								removeAutoComplete();

								var sValue = jQuery.trim($(this).val());
								if (sValue.length == 0)
								{
									if (bNewTag)
									{
										removeTag(oTag, false);
									}
									else
									{
										oCaption.html("").append(oCaption.attr('oname').replace(/</g, '&lt;'));
										removeAutoComplete();
									}
								}
								else
								{
									sValue = (sValue == '')? TAG_TEXT_UNKNOWN : sValue;
									
									setTag(oCaption, sValue, uid);
								}
								return false;
								break;
						}
					}).
					keyup(function(e){
						var oCaption = $(this).parent(); 
						var oTag = oCaption.parent().parent();
						var src = oTag.attr('fsrc');						
						
						switch (e.keyCode)
						{
							case 38: // UP
							case 40: // DOWN
								break;
							case 27: // ESC
								if (bNewTag)
								{
									removeTag(oTag, false);
								}
								else
								{
									oCaption.html("").append(oCaption.attr('oname').replace(/</g, '&lt;'));
									removeAutoComplete();
								}
								break;
							case 13: // ENTER
								break;
							default:
								var sValue = jQuery.trim($(this).val());							
							
								if (sValue.length > 0)
								{
									var aFoundUsers = [];
									
									for (iu in aImagesUsers[src])
									{
										var user = aImagesUsers[src][iu];
										if (!empty(user))
										{
											if (aFoundUsers.length == aImagesACUsers[src])
												break;
	
											var re = new RegExp('.*' + RegExp.escape(sValue) + '.*', 'i');
											
											if (re.test(user.searchBy))
												aFoundUsers.push(user);
										}
									}																	
									
									showAutoComplete($(this), sValue, aFoundUsers, oCaption.parent());
								}
							}
						});
		}
	}
	
	// Sets and saves the selected tag
	function setTag(oCaption, sName, uid, bNotSave)
	{
		sName = jQuery.trim(sName);
		sName = (sName.length == 0)? TAG_TEXT_UNKNOWN : sName;
		
		if (bNotSave == undefined)
			saveTag(null, oCaption.parent().parent(), false, uid, sName);
	}
	
	function getUserAuth()
	{
		var user_auth = "";
		
		if (!empty(m_fbUser) && !empty(m_fbSession))
			user_auth = "fb_user:" + m_fbUser + ",fb_session:" + m_fbSession;
		
		if (!empty(m_twitterUser) && !empty(m_twitterToken) && !empty(m_twitterTokenSecret))
		{
			if (!empty(user_auth)) 
				user_auth += ",";
			user_auth += "twitter_oauth_user:" + m_twitterUser + ",twitter_oauth_token:" + m_twitterToken + ",twitter_oauth_secret:" + m_twitterTokenSecret;			
		}
		
		return user_auth;
	}
	
	// Saves the tag - calls the API Client function
	function saveTag(e, oTag, bFromConfirm, _uid, _label)
	{
		var url = oTag.attr('fsrc');
		var x = oTag.attr('fx');
		var y = oTag.attr('fy');
		var width = oTag.attr('fwidth');
		var height = oTag.attr('fheight');
		var tid = (!empty(oTag.attr("tid")))? oTag.attr("tid") : "";
		var uid = '';
		
		var oUser = aImagesUsers[url][_uid];
		if (validateUser(oUser))
		{
			uid = oUser.uid + "@" + oUser.namespace;
		}
		
		// If the uid is a free one (not fb or twitter), but contains a @ (and a namesapce), use it as a uid and not as label
		if (uid == '' && _label.indexOf('@') != -1)
		{
			var parts = _label.split("@");
			var namespace = typeof parts[1] != undefined ? parts[1] : "";
			if (namespace != "")
				uid = _label;
		}
		
		// If this is demo mode - no uids are used - only labels. So if there is a uid - use it as the label
		// If tehre is also a label - take the label 
		if (m_demoMode && uid != '')
		{
			uid = '';
			if (_label == '')
				_label = uid;			
		}
		
		var user_auth = getUserAuth();
		
		if (empty(tid))
		{
			FaceClientAPI.tags_add(url, {
				x: x,
				y: y,
				width: width,
				height: height,
				label: _label,
				uid: uid,
				user_auth: user_auth,
				password: ADMIN_PASSWORD
				}, function(data){ saveTagCallback(data, oTag, bFromConfirm, _label, true, uid, url); });
		}
		else
		{
			FaceClientAPI.tags_save({
				tids: tid,
				uid: uid,
				label: _label,
				user_auth: user_auth,
				password: ADMIN_PASSWORD
			}, function(data){ saveTagCallback(data, oTag, bFromConfirm, _label, false, uid, url); });
		}
	}
	
	function saveTagCallback(data, oTag, bFromConfirm, sFullName, bManual, uid, url)
	{
		if (data.status == "failure")
		{
			animateTagError(oTag);
			error_handler(data);
			return;			
		}
		
		animateTagAction(oTag);
		
		var oName = $("#" + oTag.attr("tid") + "_name");
		
		if (bManual)
			oTag.attr("tid", data.tid);
		else
			oTag.attr("tid", data.saved_tags[0].tid);
		
		var sName = (sFullName.split(" "))[0];
		
		var oCaption = oTag.find('.f_tag_caption span');
		oCaption.html("").append(sName.replace(/</g, '&lt;'));
		oCaption.parent().attr("title", sFullName.replace(/"/g, '&quot;'));
		
		if (oName.length > 0)
		{
			oName.attr("id", data.tid + "_name");
			oName.html("").append(sFullName.replace(/</g, '&lt;'));
		}
		else
		{
			var oTagsList = oTag.parents(".f_wrapper").find(".f_tags_list");
			var needComma = true;
			if (oTagsList.length == 0)
			{
				oTagsList = createTagListContainer();
				oTag.parents(".f_wrapper").append(oTagsList);
				needComma = false;
			}
							
			var oTagListItem = getTagListItem(oTag, sFullName, true);
			
			if (needComma)
				oTagsList.append("<span>, </span>");
			oTagListItem.appendTo(oTagsList);			
		}
		
		if (oTag.find(".f_tag_remove").length == 0)
			oTag.append('<span class="f_tag_remove">X</span>');
		
		attachEventsToWrapper(oTag);
		
		if (bFromConfirm)
		{
			oTag.addClass('f_tag_readonly');
			oTag.find('.f_tag_caption').unbind('click');
		}
		else
		{
			oTag.find('.f_tag_confirm').remove();
			_tempTag = null;
		}
		
		oTag.addClass('f_tag_saved');
		oTag.removeClass('f_tag_new');
		oTag.resizable('destroy');
		oTag.draggable('destroy');
		
		tagSaved_handler(uid, sFullName, url);
	}
	
	function animateTagAction(oTag)
	{
		try
		{
			oTag.toggleClass("f_tag_update", 400, function(){ oTag.toggleClass("f_tag_update", 400); });
		}
		catch(ex){}
	}
	
	function animateTagError(oTag)
	{
		try
		{
			oTag.toggleClass("f_tag_error", 400, function(){ oTag.toggleClass("f_tag_error", 400); });
		}
		catch(ex){}
	}
	
	// Removes the tag from the screen
	function removeTag(oTag, bDelete)
	{
		if (bDelete && !oTag.hasClass("f_tag_new"))
		{
			var tid = oTag.attr('tid');
			
			var user_auth = getUserAuth();
			
			FaceClientAPI.tags_remove({
				tids: tid,
				user_auth: user_auth,
				password: ADMIN_PASSWORD
			},function(data){
				if (data.status == "failure")
				{
					animateTagError(oTag);
					error_handler(data);
					return;
				}
				
				if (oTag.attr("manual") == 'false')
				{
					var oCaption = oTag.find('.f_tag_caption span');
					oCaption.html("").append(TAG_TEXT_UNKNOWN);
					oTag.attr("tid", data.removed_tags[0].detected_tid);
					oCaption.parent().attr("title", TAG_TEXT_UNKNOWN);
					oTag.find(".f_tag_remove").remove();
					
					oTag.toggleClass("f_tag_delete", 400, function(){ oTag.toggleClass("f_tag_delete", 400); });
				}
				else
				{
					$(oTag).remove();
				}
				
				// Remove the tag name link at the bottom
				var oNameList = $('.f_tags_list');
				if (oNameList.length == $('.f_tag_name').length)
				{
					oNameList.remove();
				}
				else
				{
					var oName = $("#" + tid + "_name");
					var oNext = oName.next();
					if (oNext.html() == ", ")
						oNext.remove();
					else
					{
						if (oNext.length == 0)
						{
							oNext = oName.prev();
							if (oNext.html() == ", ")
								oNext.remove();
						}
					}
									
					oName.remove();							
				}
			});
		}
		else
		{
			$(oTag).remove();
		}
	}

	// Adds the widget style to the <head> as the first child- so if the user has any CSS files of his own they can override these properties
	function addTagsCss()
	{
		if ($('#f_style').length > 0)
			return;
		
		var css = '' +
					'.f_publish\n' +
					'{\n' +
						'position: absolute;\n' +
						'top: 2px;\n' +
						'right: 2px;\n' +
					'}\n' +
					'.f_publish img' +
					'{\n' +
						'width: 32px;\n' +
						'height: 32px;\n' +
						'cursor: pointer;\n' +
					'}\n' +
                    '.f_wrapper .f_attribution\n' +
                    '{\n' +
                        'position: absolute;\n' +
                        'bottom: 3px;\n' +
                        'right: 3px;\n' +
                        'padding: 4px 8px;\n' +
                        'background: #fff;\n' +
                        'border: 1px solid #aaa;\n' +
                        'cursor: pointer;\n' +
                        'color: #000;\n' +
                        '-moz-border-radius: 5px;\n' +
                    '}\n' +
					'.f_wrapper .f_add_tag\n' +
					'{\n' +
						'position: absolute;\n' +
						'bottom: 3px;\n' +
						'left: 3px;\n' +
						'padding: 4px 8px;\n' +
						'background: #ddd;\n' +
						'border: 1px solid #ccc;\n' +
						'cursor: pointer;\n' +
						'color: #000;\n' +
						'-moz-border-radius: 5px;\n' +
					'}\n' +
					'.f_wrapper .f_add_tag:hover\n' +
					'{\n' +
						'background: #eee;\n' +
						'border: 1px solid #ddd;\n' +
					'}\n' +
					'.f_tag\n' +
					'{\n' +
						'position: absolute;\n' +
						'border: 2px solid #ddd;\n' +
						'z-index: 5;\n' +
						'cursor: default;\n' +
						'background: transparent url(\'http://www.face.com/pix.gif\') 0 0 no-repeat;\n' +
						'overflow: visible;\n' +
					'}\n' +
					'.f_tag_hidden\n' +
					'{\n' +
						'opacity: 0 !important;\n' +
						'filter: alpha(opacity=0) !important;\n' +
					'}\n' +
					'.f_tag_visible\n' +
					'{\n' +
						'opacity: 1 !important;\n' +
						'filter: alpha(opacity=100) !important;\n' +
					'}\n' +
					'.f_tags_list\n' +
					'{\n' +
						'text-align: left;\n' +
						'position: absolute;\n' +
						'left: 0;\n' +
						'right: 0;\n' +
						'font-size: 13px;\n' +
						'cursor: default;\n' +
					'}\n' +
					'.f_tags_list b\n' +
					'{\n' +
						'color: #777;\n' +
						'font-weight: normal;\n' +
					'}\n' +
					'.f_tags_list span\n' +
					'{\n' +
						'cursor: default;\n' +
						'margin-left: 2px;\n' +
					'}\n' +
					'.f_tags_list span:hover\n' +
					'{\n' +
						'text-decoration: underline;\n' +
					'}\n' +
					'.f_tag_m_loading\n' +
					'{\n' +
						'position: absolute;\n' +
						'top: 3px;\n' +
						'right: 3px;\n' +
						'z-index: 15;\n' +
						'font-size: 12px;\n' +
						'opacity: .5;\n' +
						'filter: alpha(opacity=50);\n' +
					'}\n' +
					'.f_tag_loading\n' +
					'{\n' +
						'padding: 1px 4px;\n' +
						'margin: 2px 0;\n' +
						'text-align: right;\n' +
						'background: #bbb;\n' +
					'}\n' +
					'.f_tag_trans\n' +
					'{\n' +
						'opacity: .8;\n' +
						'filter: alpha(opacity=80);\n' +
					'}\n' +
					'.f_tag_new\n' +
					'{\n' +
						'z-index: 15;\n' +
						'cursor: move;\n' +
					'}\n' +
					'.f_tag_trans:hover, .f_tag_trans_hover\n' +
					'{\n' +
						'opacity: 1;\n' +
						'filter: alpha(opacity=100);\n' +
						'z-index: 6;\n' +
						'margin: -1px 0 0 -1px;\n' +
						'border-width: 3px;\n' +
					'}\n' +
					'.f_tag:hover\n' +
					'{\n' +
						'z-index: 10;\n' +
					'}\n' +
					'.f_tag .f_tag_remove\n' +
					'{\n' +
						'position: absolute;\n' +
						'top: 0;\n' +
						'right: 1px;\n' +
						'z-index: 10;\n' +
						'font-weight: bold;\n' +
						'color: #a00;\n' +
						'cursor: pointer;\n' +
						'font-size: 13px;\n' +
					'}\n' +
					'.f_tag .f_tag_remove:hover\n' +
					'{\n' +
						'color: #c00;\n' +
					'}\n' +
					'.f_tag .f_tag_caption\n' +
					'{\n' +
						'position: absolute;\n' +
						'top: 0;\n' +
						'left: 0;\n' +
						'right: 0;\n' +
						'padding: 1px 0;\n' +
						'text-align: center;\n' +
						'background: #ddd;\n' +
						'font-size: 11px;\n' +
						'cursor: pointer;\n' +
						'z-index: 10;\n' +
						'overflow: hidden;\n' +
					'}\n' +
					'.f_tag .f_tag_caption input\n' +
					'{\n' +
						'width: 100%;\n' +
						'border-width: 0;\n' +
						'text-align: center;\n' +
						'font-size: 11px;\n' +
						'font-family: Arial;\n' +
						'padding: 0;\n' +
					'}\n' +
					'.f_tag .f_tag_caption:hover\n' +
					'{\n' +
						'text-decoration: underline;\n' +
					'}\n' +
					'.f_tag .f_tag_confirm\n' +
					'{\n' +
						'position: absolute;\n' +
						'bottom: 0;\n' +
						'right: 0;\n' +
						'width: 32px;\n' +
						'height: 32px;\n' +
						'cursor: pointer;\n' +
						'background: transparent url(\'http://www.horsecentre.com.au/forum/images/icons/thumbs_up.png\') 0 0 no-repeat;\n' +
						'display: none;\n' +
						'z-index: 10;\n' +
					'}\n' +
					'.f_tag:hover .f_tag_confirm\n' +
					'{\n' +
						'display: block;\n' +
					'}\n' +
					'.f_tag_update\n' +
					'{\n' +
						'border-color: #2d0;\n' +
						'z-index: 11;\n' +
					'}\n' +
					'.f_tag_delete, .f_tag_error\n' +
					'{\n' +
						'border-color: #d20;\n' +
						'z-index: 11;\n' +
					'}\n' +
					'.f_tag_readonly\n' +
					'{\n' +
						'opacity: 1;\n' +
						'filter: alpha(opacity=100);\n' +
					'}\n' +
					'.f_tag_readonly .f_tag_caption, .f_tag_readonly .f_tag_caption:hover\n' +
					'{\n' +
						'cursor: default;\n' +
						'text-decoration: none;\n' +
					'}\n' +
					'.f_tag_readonly:hover .f_tag_confirm\n' +
					'{\n' +
						'display: none;\n' +
					'}\n' +
					'.f_tag #f_autocomplete\n' +
					'{\n' +
						'position: absolute;\n' +
						'width: 100%;\n' +
						'min-width: 100px;\n' +
						'top: 19px;\n' +
						'left: 0;\n' +
						'background: #ddd;\n' +
						'border: 1px solid #fff;\n' +
						'outline: 1px solid #bbb;\n' +
						'max-height: 300px;\n' +
						'overflow-y: auto;\n' +
						'z-index: 1004;\n' +
						'text-align: left;\n' +
						'zoom: 1;\n' +
						'z-index: 500;\n' +
						'font-size: 10px;\n' +
					'}\n' +
					'.f_tag #f_autocomplete .close\n' +
					'{\n' +
						'position: absolute;\n' +
						'top: 0;\n' +
						'right: 0;\n' +
						'width: 12px;\n' +
						'height: 12px;\n' +
						'line-height: 12px;\n' +
						'text-align: center;\n' +
						'cursor: pointer;\n' +
						'color: #fff;\n' +
						'background: #a00;\n' +
						'-moz-border-radius: 12px 0 12px 12px;\n' +
						'-webkit-border-radius: 12px 0 12px 12px;\n' +
						'border-radius: 12px 0 12px 12px;\n' +
					'}\n' +
					'.f_tag #f_autocomplete div\n' +
					'{\n' +
						'cursor: pointer;\n' +
						'clear: both;\n' +
						'width: 100%;\n' +
						'float: left;\n' +
					'}\n' +
					'.f_tag #f_autocomplete div:nth-child(odd)\n' +
					'{\n' +
						'background: #eee;\n' +
					'}\n' +
					'.f_tag #f_autocomplete div:hover, #f_autocomplete .current\n' +
					'{\n' +
						'background: #000 !important;\n' +
						'color: #fff;\n' +
					'}\n';
				
		switch(design)
		{
			case 'default':
				css += '\n' +
						'.f_tag\n' +
						'{\n' +
							'-moz-box-shadow: 0 0 10px 0 #000;\n' +							
							'-webkit-box-shadow: 0 0 10px 0 #000;\n' +
							'box-shadow: 0 0 10px 0 #000;\n' +
							'-moz-border-radius: 15px;\n' +
							'-webkit-border-radius: 15px;\n' +
							'border-radius: 15px;\n' +							
						'}\n' +
						'.f_tag_caption, .f_tag_caption input\n' +
						'{\n' +
							'-moz-border-radius-topleft:10px;\n' +
							'-moz-border-radius-topright:10px;\n' +
							'-webkit-border-radius-topleft:10px;\n' +
							'-webkit-border-radius-topright:10px;\n' +
							'border-radius-topleft:10px;\n' +
							'border-radius-topright:10px;\n' +							
						'}\n' +						
						'.f_tag_saved\n' +
						'{\n' +
							'-moz-box-shadow: 0 0 0 0 #000;\n' +							
							'-webkit-box-shadow: 0 0 0 0 #000;\n' +
							'box-shadow: 0 0 0 0 #000;\n' +
							'-moz-border-radius: 15px;\n' +
							'-webkit-border-radius: 15px;\n' +
							'border-radius: 15px;\n' +							
						'}\n';				
				break;
			case 'round':
				css += '\n' +
						'.f_tag\n' +
						'{\n' +
							'border-width: 3px;\n' +
							'-moz-border-radius: 50%;\n' +
							'-webkit-border-radius: 50%;\n' +
							'border-radius: 50%;\n' +
							'margin-top: -3px;\n' +
							'margin-left: -3px;\n' +
						'}\n' +
						'.f_tag .f_tag_caption\n' +
						'{\n' +
							'background: transparent;\n' +
							'top: auto;\n' +
							'bottom: -10px;\n' +
						'}\n' +
						'.f_tag .f_tag_caption span\n' +
						'{\n' +
							'display: inline-block;\n' +
							'background: #fed;\n' +
							'padding: 3px 0;\n' +
							'width: 100%;\n' +
						'}' +
						'.f_tag .f_tag_confirm\n' +
						'{\n' +
							'top: 50%;\n' +
							'left: 50%;\n' +
							'bottom: auto;\n' +
							'margin: -16px 0 0 -16px;\n' +
						'}';
				break;
			case 'arch':
				css += '\n' +
						'.f_tag\n' +
						'{\n' +
							'-moz-border-radius: 50% 50% 0 0;\n' +
							'-webkit-border-radius: 50% 50% 0 0;\n' +
							'border-radius: 50% 50% 0 0;\n' +
						'}\n' +
						'.f_tag .f_tag_caption\n' +
						'{\n' +
							'top: auto;\n' +
							'bottom: 0;\n' +
						'}';
				break;
			case 'wood':
				css += '\n' +
						'.f_tag\n' +
						'{\n' +
							'border: 10px double #b4a28f;\n' +
							'margin-left: -10px;\n' +
							'margin-top: -10px;\n' +
						'}\n' +
						'.f_tag .f_tag_caption\n' +
						'{\n' +
							'background: transparent;\n' +
							'top: auto;\n' +
							'bottom: -17px;\n' +
							'font-weight: bold;\n' +
						'}\n' +
						'.f_tag .f_tag_caption span\n' +
						'{\n' +
							'display: inline-block;\n' +
							'background: #fed;\n' +
							'padding: 5px 15px;\n' +
							'background-color: #b4a28f;\n' +
						'}';
				break;
			case 'zeedevil':
				css += '\n' +
						'.f_tag\n' +
						'{\n' +
							'border-width: 0;\n' +
						'}\n' +
						'.f_tag .f_tag_caption\n' +
						'{\n' +
							'background: #a00;\n' + 
							'margin: 0 25px;\n' +
							'-moz-border-radius: 0 0 8px 8px;\n' +
							'-webkit-border-radius: 0 0 8px 8px;\n' +
							'border-radius: 0 0 8px 8px;\n' +
							'height: 14px;\n' +
							'overflow: hidden;\n' +
							'display: none;\n' +
						'}' +
						'.f_tag:hover .f_tag_confirm\n' +
						'{\n' +
							'display: none;\n' + 
						'}';
				break;
			case 'facebook':				
				css += '\n' +
					'.f_tag\n' +
					'{\n' +
						'border-width: 0;\n' +
						'opacity: 1;' +
						'filter: alpha(opacity=100);' +
					'}\n' +
					'.f_tag .f_tag_caption\n' +
					'{\n' +
						'top: auto;\n' +
						'bottom: -15px;\n' +
						'min-width: 100%;' +
						'padding: 0;' +
					'}' +
					'.f_tag .f_tag_caption:hover\n' +
					'{\n' +
						'text-decoration: none;' +
					'}' +
					'.f_tag .f_tag_caption span\n' +
					'{\n' +
						'background: #333;\n' + 
						'display: block;\n' +
						'padding: 3px;\n' +
						'margin: 0 auto;\n' +
						'color: #fff;\n' +
						'font-weight: bold;\n' +
						'font-size: 12px;\n' +
					'}\n' +
					'.f_tag .f_tag_remove\n' +
					'{\n' +
						'top: auto;\n' +
						'bottom: -9px;\n' +
					'}\n';
			default:
		}
		
		var oStyle = $('<style type="text/css" id="f_style">' + css + '</style>');
		$('head').prepend(oStyle);
	}
	
	//----------------
	// EXTERNAL PROVIDERS
	//----------------
	
	// If twitter username is passed, load the user's friends
	function setupTwitter(twitter_user, twitter_token, twitter_token_secret)
	{
		m_twitterUser =  twitter_user;
		m_twitterToken =  twitter_token;
		m_twitterTokenSecret = twitter_token_secret;
		
		var url_oauth_params = "oauth_user="+m_twitterUser+"&oauth_token="+m_twitterToken+"oauth_token_secret="+m_twitterTokenSecret;
		
		window.setTimeout(function(){
			var url = "http://twitter.com/users/show.json?id=" + encodeURIComponent(m_twitterUser) + "&" + url_oauth_params + "&callback=?";
			dbug("log", "Twitter: Initialized (getting screen name of owner), calling jsonp service for \"" + twitter_user + "\"\n" + url);
			
			$.jsonp({
					'url': url,
					'timeout': TIMEOUT_TWITTER, 
					'success': function(data){
						dbug("log", "Twitter: got user data from twitter");						
						
						m_twitterScreenName = data.screen_name;									
																
						dbug("log", "Twitter: Done loading screen_name of " + m_twitterUser + ": " + m_twitterScreenName);
					},
					'error': function(data, msg) {
						dbug("warn", "Twitter: Error loading user " + m_twitterUser +  " from twitter (" + msg + ")");
					}					
			});
		});
		
		window.setTimeout(function(){
			var url = "http://twitter.com/statuses/friends.json?id=" + encodeURIComponent(m_twitterUser) + "&" + url_oauth_params + "&callback=?";
			dbug("log", "Twitter: Initialized, calling jsonp service for \"" + twitter_user + "\"\n" + url);
			
			$.jsonp({
					'url': url,
					'timeout': TIMEOUT_TWITTER, 
					'success': function(data){
						dbug("log", "Twitter: got " + data.length + " friends from twitter");
						for (var i=0; i<data.length; i++)
						{
							var tUser = data[i];
							
							var user = {
										uid: tUser.screen_name,
										namespace: "twitter.com",
										first_name: "@" + tUser.screen_name,
										last_name: "",
										location: tUser.location,
										profile_pic: tUser.profile_image_url,
										profile_link: "http://www.twitter.com/" + tUser.screen_name + "/",
										searchBy: tUser.name + " @" + tUser.screen_name,
										format: function(user, search){
												return user.first_name + " " + user.last_name;
											}
										};
							
							for (img in aImagesUsers)
							{
								aImagesUsers[img]["u" + user.uid] = user;
							}
						}
						
						dbug("log", "Twitter: Done loading users from twitter");
					},
					'error': function(data, msg) {
						dbug("warn", "Twitter: Error loading users from twitter (" + msg + ")");
					},
					'complete': function(options, status){
						removeLoading(document.body, LOADING_TWITTER_USERS);
					}
			});
		});
	}
	
	// If facebook:true is passed and there's an FB object, load the logged in user's friends
	function setupFacebook(bShowLoading)
	{
		if (!bShowLoading)
			return;
		
		if (typeof FB == "undefined" || empty(FB))
		{
			dbug("error", "Facebook object not initialized");
			return false;
		}
		
		var oldFBApi = FB.ensureInit ? true : false;
		
		dbug("log", "FBConnect: Initialized, using " + (oldFBApi ? "old" : "new") + " facebook library");
						
		var ensureInit = oldFBApi ? FB.ensureInit : FB.getLoginStatus;		
		ensureInit(function (response) {
			
			var osession = oldFBApi ? FB.Facebook.apiClient.get_session() : response.session;
											
			if (osession != null)
			{
				var uid = osession.uid;
				dbug("log", "FBConnect: uid=" + uid);
				
				m_fbUser = uid;
				m_fbSession = osession.session_key;
				
				var wrappers = $('.f_wrapper');
				var publish = wrappers.find('.f_publish');
				if (publish.length == 0)
				{
					publish = $('<div class="f_publish"></div>');
					wrappers.append(publish);
				}
				
				publish.append('<img src="http://static.face.com/misc/Facebook_icon.gif" alt="Share on Facebook" title="Share on Facebook" />');
				
				publish.click(function(){
					var attachment = {
										'caption': TXT_FB_STREAM_CAPTION,
										'properties': {'Visit face.com': {'text': 'face.com', 'href': window.location.href}},
										'media': [
							                    {'type':'image',
								                 'src': $(this).parent().find("img:first-child").attr('src'),
								                 'href': window.location.href }
							                    ]};
					
					if (oldFBApi)
					{
						FB.Connect.streamPublish('',  attachment,  null,  null, TXT_FB_STREAM_PROMPT);
					}
					else
					{
						FB.ui(
						   {
						     method: 'stream.publish',
						     message: '',
						     attachment: attachment,						     
						     user_message_prompt: TXT_FB_STREAM_PROMPT
						   }						
						 );
					}
					
					return false;
				});							
				
				showLoading(document.body, LOADING_FACEBOOK_USERS);							
				
				dbug("log", "FBConnect: getting friends (FQL)");
				
				var fql = "SELECT uid, first_name, last_name, name, pic_square, profile_url, locale  FROM user WHERE uid=" + uid + " OR uid IN (SELECT uid2 FROM friend WHERE uid1 = " + uid + ")";
				
				if (oldFBApi)
				{
					FB.Facebook.apiClient.fql_query(fql, postFQLCallback);
				}
				else
				{
					FB.api( 
							{
								method: 'fql.query',
								query: fql
							},
							postFQLCallback);

				}										
			}
		});
		
		return true;
	}
	
	function postFQLCallback(rows){
		dbug("log", "FBConnect: got " + rows.length + " friends from Facebook");
		
		for (var i=0; i<rows.length; i++)
		{
			var user = {
					uid: rows[i]["uid"],
					namespace: "facebook.com",
					first_name: rows[i]["first_name"],
					last_name: rows[i]["last_name"],
					location: rows[i]["locale"],
					profile_pic: rows[i]["pic_square"],
					profile_link: rows[i]["profile_url"],
					searchBy: rows[i]["first_name"] + " " + rows[i]["last_name"],
					format: function(user, search){
							var name = user.first_name + " " + user.last_name;
							var regex = new RegExp("(" + search + ")", "gi");
							name = name.replace(regex, "<b>$1</b>");
							return '<img src="' + user.profile_pic + '" alt="" width="25" height="25" style="vertical-align: middle; float: left; margin: 1px 2px 1px 1px;" /> ' + name;
						}
					};
		
			for (img in aImagesUsers)
			{
				aImagesUsers[img]["u" + user.uid] = user;
			}
		}
		
		dbug("log", "FBConnect: Done loading users from facebook");
		removeLoading(document.body, LOADING_FACEBOOK_USERS);
	}
	
	//----------------
	// AUTO COMPLETE
	//----------------
	
	// Shows the autocomplete on the screen
	function showAutoComplete(oInput, sValue, aFoundUsers, oCaption)
	{
		if (aFoundUsers.length > 0)
		{
			var autocomplete = $('#f_autocomplete');
			
			if (autocomplete.length != 0 && sValue == '')
				return;
			
			oInput = $(oInput);
			
			var oTag = oCaption.parent();
			
			var sHTML = '<span class="close">x</span>';
			var iInputWidth = oInput.width();
			
			// Set font size according to the width of the element
			var sStyle = (iInputWidth <= 55)? 'font-size: 65%;' : ((iInputWidth <= 70)? 'font-size: 80%;' : ((iInputWidth <= 100)? 'font-size: 90%;' : ''));
			if (sStyle != '')
				sStyle = 'style="' + sStyle + '"';
			
			sStyle = '';
			
			// Construct the list of users from the aFoundUsers array
			for (var i=0; i<aFoundUsers.length; i++)
			{
				var format = aFoundUsers[i].format(aFoundUsers[i], sValue);
				
				sHTML += '<div ' + ((i==0)? 'class="current"' : '') + ' ' + sStyle + ' uid="u' + aFoundUsers[i].uid + '">' + format + '</div>';
			}

			// Create the Auto Complete element if it doesn't exist
			if (autocomplete.length == 0)
			{
				var fnac = $('<div id="f_autocomplete"></div>');
					fnac.css('left', oInput.css('left'));
				
				oTag.append(fnac);

				var	iTop = ((oCaption.css('top') == 'auto')? oTag.height() + 9 : parseInt(oCaption.css('top')) + oCaption.height() + 1) + 'px';
				fnac.css('top', iTop);
				
				autocomplete = $('#f_autocomplete');
			}					
			
			// Populate the autocomplete list and add click events to each option
			autocomplete.html("").append(sHTML).find('div').click(function(e){
				setTag($(oCaption.children()[0]), $(this).text(), $(this).attr("uid"));
				removeAutoComplete();
				return false;
			});
			
			var currCaption = oCaption;
			autocomplete.find('.close').click(function(e){
				var currCaption = $($(this).parent().parent().find('.f_tag_caption').children()[0]);								
				currCaption.html("").append(currCaption.attr('oname').replace(/</g, '&lt;'));
				removeAutoComplete();															
				return false; 
			});
			
			if (autocomplete.width() > oTag.width())
			{
				autocomplete.css("left", "-" + (autocomplete.width() - oTag.width())/2 + "px");
			}
			
			// This is due to crappy IE bug when "overflow: visible" doesn't work if the element isn't fully opaque!
			oTag.removeClass("f_tag_trans");
		}
		else
		{
			removeAutoComplete();
		}
	}
	
	function defaultUserFormat(user, sValue)
	{
		var format = user.first_name + " " + user.last_name;
		
		if (sValue != '')
		{
			var re = new RegExp('(' + RegExp.escape(sValue) + ')', 'i');
			format = format.replace(/</g, '&lt;').replace(re, '<b>$1</b>');
		}
		
		return format;
	}
	
	// Scroll the autocomplete list up and down
	// Used when user is hitting the UP or DOWN keys
	function pageAutoComplete(step)
	{
		var current = $('#f_autocomplete div.current');
		var toAdd = null;
		
		if (current.length == 0)
		{
			var options = $('#f_autocomplete div');
			toAdd = (step == 1)? $(options[0]) : $(options[options.length - 1]);
		}
		else
		{
			current = $(current[0]);
			toAdd = (step == 1)? current.next() : current.prev();
		}
		
		if (toAdd.length == 0)
			toAdd = (step == 1)? $('#f_autocomplete div:first-child') : $('#f_autocomplete div:last-child') ;
		
		toAdd.addClass('current');
		
		if (toAdd[0] != current[0])
			current.removeClass('current');
	}
	
	// Sets the text of the tag to the selected autocomplete user
	// Used when user hits ENTER in the tag input
	function checkAutoComplete(oField)
	{
		var current = $('#f_autocomplete div.current');
		if (current.length > 0)
		{
			$(oField).val(current.text());
			return current.attr("uid");
		}
		return false;
	}
	
	// Removes the autocomplete from the screen 
	function removeAutoComplete()
	{
		// This is due to crappy IE bug when "overflow: visible" doesn't work if the element isn't fully opaque!
		var oAC = $('#f_autocomplete');
		oAC.parent().addClass("f_tag_trans");
		oAC.remove();
	}
	
	function isAdminMode()
	{
		return (window.location.href.indexOf("tagger_admin_mode") != -1);
	}

	//-------------------
	// Helper Functions
	//-------------------
	
	// Validates a user object
	function validateUser(user)
	{
		return (!empty(user) && !empty(user.uid) && !empty(user.first_name));
	}
	
	// Helper function to check if a string or an object is empty
	function empty(s)
	{
		var b = true;

		if (typeof s == "string")
			b = (s.replace(/ /g,'').length == 0);
		else
			b = (s == undefined || s == null);
		
		return b;
	}

	// Escapes RegEx special characters (add \ before)
	if (typeof RegExp.escape != 'function')
	{
		RegExp.escape = function(text) {
		  if (!arguments.callee.sRE) {
		    var specials = [
		      '/', '.', '*', '+', '?', '|',
		      '(', ')', '[', ']', '{', '}', '\\'
		    ];
		    arguments.callee.sRE = new RegExp(
		      '(\\' + specials.join('|\\') + ')', 'g'
		    );
		  }
		  return text.replace(arguments.callee.sRE, '\\$1');
		}
	}
	
	// Make sure the data received from the API is OK
	function validateAPIResponse(data)
	{
		if (data == undefined || data == null || typeof data != "object")
			return false;
		
		if (typeof data == "object" && data.status != undefined && data.status == "failure")
		{
			dbug("info", "Error from API Client: " + data.error_message);
			return false;
		}
		
		return true;
	}
	
	function loadJavaScript (url)
	{
		var st = document.createElement("script");
		st.src = url;
		st.type = "text/javascript";
		var head = document.getElementsByTagName('head')[0];
		head.appendChild(st);
	}
	
	// Print debug messages (FireBug console)
	function dbug(type, message)
	{
		if (DEBUG && typeof console == "object")
		{
			if (typeof console[type] == "function")
				console[type](message);
			else
				console.log(message);
		}
	}
	
	function handleError(ex)
	{
		throw ex;
	}
	
	function tagSavedHandler(uid, label, url)
	{		
	}

}

// jQuery CSS (Resizable etc.)
document.write('<style type="text/css">' +
				'.ui-resizable { position: relative;} ' +
				'.ui-resizable-handle { position: absolute;font-size: 0.1px;z-index: 99999; display: block;} ' +
				'.ui-resizable-disabled .ui-resizable-handle, .ui-resizable-autohide .ui-resizable-handle { display: none; } ' +
				'.ui-resizable-n { cursor: n-resize; height: 7px; width: 100%; top: -5px; left: 0px; } ' +
				'.ui-resizable-s { cursor: s-resize; height: 7px; width: 100%; bottom: -5px; left: 0px; } ' +
				'.ui-resizable-e { cursor: e-resize; width: 7px; right: -5px; top: 0px; height: 100%; } ' +
				'.ui-resizable-w { cursor: w-resize; width: 7px; left: -5px; top: 0px; height: 100%; } ' +
				'.ui-resizable-se { cursor: se-resize; width: 12px; height: 12px; right: 1px; bottom: 1px; } ' +
				'.ui-resizable-sw { cursor: sw-resize; width: 9px; height: 9px; left: -5px; bottom: -5px; } ' +
				'.ui-resizable-nw { cursor: nw-resize; width: 9px; height: 9px; left: -5px; top: -5px; } ' +
				'.ui-resizable-ne { cursor: ne-resize; width: 9px; height: 9px; right: -5px; top: -5px;}' +
			'</style>')

if (typeof FaceClientAPI != "undefined")
	this.FaceTagger = new Face_Tagger(FaceClientAPI);