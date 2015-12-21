// Shared Logic between client and server
console.debug = function ()
{
	console.log.apply(this, arguments);
}

SubscriptionEntry =
{
	item_id: 			null,
	plan_id: 			null,
	discount_id: 		null,
	bundle_id: 			null,
	bundle_rule_id: 	null,
	final_price_after_promotion: 		0
}

SubscriptionFilter =
{
	Active: 			0,
	Pending: 			1,
	Archive: 			2
}

SearchFilters = {
	partner: {
		PartnerOnly: 1,
		Both: 2
	}
}

StoreItemType =
{
	None:				0,
	Subscription:		1,
	Issue:				2,
	Product:			3,
	Bundle:				4
}

PeriodicalType =
{
    Daily: 1,
    Weekly: 2,
    Monthly: 3
}

DiscountCodeType =
{
    PromotionCode: 0,
    CouponCode: 1,
	RedemptionCodeSingleUse: 2,
	RedemptionCodeMultiUse: 3,
    ReaderCodeSingleUser: 4,
    ReaderCodeMultiUser: 5
}

TransactionEntryType =
{
	Subscription:		0,
	IssuePurchase:		1,
	ProductPurchase:	2
}

ProductType =
{
	Item:				0,
	Issue:				1,
	Product:			2
}
// http://thestar.p2l.com:9000/store/#/pending
NotificationType =
{
	Info: 				0,
	Error: 				1
}

BundleRuleSelectionsType =
{
	Subscriptions:		0,			// items
	Issues:				1,
	Products:			2
}

CDNServerType =
{
	AmazonS3:			0,			// use default S3 server
	URL:				1,			// use Nation's TCC
    Local:              2,
	RSync:				3			// Rsync to CDN
}


// System type of the purchase option that instructs how to treat given purchase
// If it's a digital issue, it should be added to the user's dashboard, if it's a hardcopy
// it should appear in the dispatch list for the publisher and should require shipping address
PurchaseOptionType =
{
	Digital:				0,
	Physical:				1
}

PromotionCodeType =
{
	TimeBased:				0,
	VolumeBased: 			1
}

PromotionCodeApplicableType =
{
    SpecificItems: 0,
    AllItems: 1,
    AllDigitals: 2,
    AllHardcopys:3
}

// NOTE: New e-mail types need to have filter created inside fitlers.js file!
EmailType =
{
	NotificationEmail:				-1,
	UserWelcome: 					0,
	UserSuspend: 					1,
	UserPasswordReset: 				2,
	UserReactivated: 				3,
	UserSubscriptionTerminated: 	4,
	UserSubscriptionAdded: 			5,
	UserPasswordResetSuccessful: 	6,
	UserAccountActivation: 			7,
	UserAutoActivated: 				8,
	UserInvoice: 					9,
    NewsletterPromotion:            10,
    NewsletterFeaturedItem:         11,
    NewsletterHappyHoliday:         12,
    NewsletterDealNotification:     13,
    UserReceipt:                    14,
	MailingLabel:					15,
	ShippingStatus:					16,
    EmailHeader:                    17,
    EmailFooter:                    18
}

// NOTE: New newsletter types need to have filter created inside fitlers.js file!
NewsletterType =
{
	PublisherSales:					0,
	PublisherPromotion:				1,
	NewsletterHeader:				2,
	NewsletterFooter:				3
}

StoreModules =
{
	FacebookAuth:					"facebook",
	Reviews:						"reviews",
	XSamples:						"xsamples",
	SocialSharing:					"social-sharing",
	RecentHistory:					"recent-history",
	EditorsPick:					"editors-pick",
	NewArrivals: 					"new-arrivals",
	BestSellers:					"best-sellers",
	Annotations:					"annotations",
	Recommendations:				"recommendations",
	Highlights:						"highlights",
	SubscriptionCode:				"subscription-code"
};

Sort =
{
	Asc:		1,
	Desc:		2
}

PropertyType =
{
	None:		0,
	Bool:		1,
	String:		2,
	Text:		3,
	Integer:	4,
	Date:		5,
    Categories: 6
}

/**
 * Enums
 */
UserStatus =
{
	Active: 0,
	Suspended: 1,
	Inactive: 2								// account must be activated first
}

SubscriptionStatus =
{
	Pending: 0,								// subscription has to been yet activated (for example it's scheduled for later or not yet paid)
	Active: 1,								// subscription is running
	Expired: 2,								// subscription has expired
	Terminated: 3,								// subscription has been terminated
	Unpaid: 4								// subscription has never been paid
}

TransactionStatus =
{
	Pending: 	0,							// transaction awaiting payment
	Paid: 		1,							// transaction has been paid
	Unpaid: 	2,							// transaction was never paid
	Canceled: 	3							// transaction was canceled by the user (before it was paid)
}

ShippingStatus =
{
	Unhandled:		0,
	Dispatched:		1,
	WontDispatch:	2,
	Reviewing:		3,
}

PurchaseStatus =
{
	Pending: 0,								// purchase is pending payment
	Paid: 1,								// purchase has been paid
	Unpaid: 2								// purchase was never paid
}

UserRole =
{
	None: 0,
	Admin: 1,
	Publisher: 2
}

SpamFlags =
{
	Normal: 0,
	Spam: 1
}

ReviewStatus =
{

	WaitingApproval: 0,
	Approved: 1,
	Disapproved: 2,
	ApprovedAndReportResolved: 3
}


IssueStatus =
{
	Created: 			0,					// issue has been created but with no files
	Editable: 			1,					// files have been uploaded & copied, issue is now editable
	Ready: 				2,					// issue is ready for uploading now (.plist received)
	Online: 			3					// issue has been uploaded to the CDN
}

IssueFilesStatus =
{
	None: 0,								// no files has been uploaded yet
	Uploaded: 1,								// files uploaded to FTP, need to be copied
	Copied: 2								// files has been successfully copied
}

IssueProcessingStatus =
{
	None: 				0,					// processing has not been started yet
	Processing: 		1,					// processing under way
	Finished: 			2,					// processing is finished
	Copied: 			3,					// processing files have been copied and ready
	Error:				4
}

IssueDeploymentStatus =
{
	NotDeployed:		0,					// issue was never deployed
	Deploying:			1,					// deployment in progress
	Deployed:			2,					// deployed successfully
	Error:				3					// last deployment attempt resulted in error
}

PublisherSettings =
{
	editor: {
		defaultARiseImage: null,
        defaultIsnapImage: null,
		defaultVideoImage: null
	}
}

PaymentType =
{
	Free:			0,
	AsiaPay:		1,
	PaysBuy:		2,
	AppStore:		3,
    OffLine:        4,
	GooglePlay:		5,
	Paypal:			6
}

PaysBuyPaymentMethod =
{
	PaysBuyAccount:		1,
	CreditCard:			2,
	PayPal:				3,
	AmericanExpress:	4,
	OnlineBanking:		5,
	CounterService:		6
}

// Trackable ARise item types (not the reduced type list used by ipad)
ARiseItemType =
{
	None: 			0,
	Banner: 		1,
	Button: 		2,
	Gallery: 		3,
	Video: 			4,
	Website: 		5,
	Social: 		6,
	Form: 			7,
	BrandDisplay: 	8,
	Model3D: 		9
}

PushNotificationRule =
{
	None:			0,
	ExpiredSub:		1,
	InactiveUser:	2,
	RedeployedIssue: 3,
	NewIssue:		4
}

SubscriptionPlanDurationType =
{
	Months:			0,
	Days:			1
}

ProductOnlineStatus =
{
	Offline:		0,
	Online:			1,
	Standby:		2
}

IDPREPEND =
{
	TRANSACTION: "TRASX",
	SHIPPING: "SHPNG"
}


PermissionType =
{
	None:	0,
	Read:	1,
	Edit:	2
}

TaxType =
{
	None: 0,
	Include: 1,
	Exclude: 2
}

DeviceType =
{
	None: 0,
	Apple: 1,
	Android: 2
}

Gender =
{
	None: 0,
	Male: 1,
	Female: 2
}

CMSPermissions =
[
	{ title: "Overview", 				column: "cms_overview" },
	{ title: "Subscriptions", 			column: "cms_items" },
	{ title: "Digital Content", 		column: "cms_issues" },
	{ title: "Discounts", 				column: "cms_discounts" },
	{ title: "Bundles", 				column: "cms_bundles" },
	{ title: "Accounts", 				column: "cms_accounts" },
	{ title: "User Subscriptions", 		column: "cms_subscriptions" },
	{ title: "Purchases", 		        column: "cms_purchases" },
	{ title: "Transactions", 			column: "cms_transactions" },
	{ title: "Configuration", 			column: "cms_configuration" },
	{ title: "Auto-Subscribe", 			column: "cms_autosubscribe" },
	{ title: "E-Mail Templates",      	column: "cms_email" },
	{ title: "Store Configuration", 	column: "cms_store" },
	{ title: "E-Reader",         		column: "cms_ipad" },
    { title: "Static Pages",            column: "cms_static_pages"},
    { title: "Physical Products",		column: "cms_products" },
	{ title: "Coupons and Vouchers", 	column: "cms_promotion_codes"},
	{ title: "Shipping",				column: "cms_shipping" },
    { title: "Reviews", 		        column: "cms_reviews"},
    { title: "Product Highlights", 		column: "cms_highlights"},
    { title: "Remote Notifications",    column: "cms_push_notification"},
    { title: "Product Types",           column: "cms_product_types"},
    { title: "Categories",              column: "cms_categories"},
	{ title: "Newsletter Templates",	column: "cms_newsletter"},
    { title: "Newsletter Notification",	column: "cms_newsletter_notification"},
	{ title: "Adedge Admin Level Access", 		column: "adedge_admin_level_access"},
	{ title: "Adedge Sales Report",				column: "adedge_sales_report"},
	{ title: "Adedge Sales Report Individual", 	column: "adedge_sales_report_ind"},
	{ title: "Adedge Users Report",				column: "adedge_users_report"},
	{ title: "Adedge Store Traffic Report", 	column: "adedge_store_traffic_report"},
	{ title: "Adedge Store Visitors Report", 	column: "adedge_store_visitors_report"},
	{ title: "Adedge EReader Report", 			column: "adedge_ereader_report"},
	{ title: "Adedge EReader Report Individual", column: "adedge_ereader_report_ind"},
	{ title: "Adedge EDM Report",		column: "adedge_edm_report"}
];

CountryList = [
	"Afghanistan Albania",
	"Algeria",
	"American Samoa",
	"Andorra",
	"Angola",
	"Anguilla",
	"Antarctica",
	"Antigua and Barbuda",
	"Argentina",
	"Armenia",
	"Aruba",
	"Australia",
	"Austria",
	"Azerbaijan",
	"Bahamas",
	"Bahrain",
	"Bangladesh",
	"Barbados",
	"Belarus",
	"Belgium",
	"Belize",
	"Benin",
	"Bermuda",
	"Bhutan",
	"Bolivia",
	"Bosnia and Herzegowina",
	"Botswana",
	"Bouvet Island",
	"Brazil",
	"British Indian Ocean Territory",
	"Brunei Darussalam",
	"Bulgaria",
	"Burkina Faso",
	"Burundi",
	"Cambodia",
	"Cameroon",
	"Canada",
	"Cape Verde",
	"Cayman Islands",
	"Central African Republic",
	"Chad",
	"Chile",
	"China",
	"Christmas Island",
	"Cocos (Keeling) Islands",
	"Colombia",
	"Comoros",
	"Congo",
	"Congo, the Democratic Republic of the",
	"Cook Islands",
	"Costa Rica",
	"Cote d'Ivoire",
	"Croatia (Hrvatska)",
	"Cuba",
	"Cyprus",
	"Czech Republic",
	"Denmark",
	"Djibouti",
	"Dominica",
	"Dominican Republic",
	"East Timor",
	"Ecuador",
	"Egypt",
	"El Salvador",
	"Equatorial Guinea",
	"Eritrea",
	"Estonia",
	"Ethiopia",
	"Falkland Islands (Malvinas)",
	"Faroe Islands",
	"Fiji",
	"Finland",
	"France",
	"France, Metropolitan",
	"French Guiana",
	"French Polynesia",
	"French Southern Territories",
	"Gabon",
	"Gambia",
	"Georgia",
	"Germany",
	"Ghana",
	"Gibraltar",
	"Greece",
	"Greenland",
	"Grenada",
	"Guadeloupe",
	"Guam",
	"Guatemala",
	"Guinea",
	"Guinea-Bissau",
	"Guyana",
	"Haiti",
	"Heard and Mc Donald Islands",
	"Holy See (Vatican City State)",
	"Honduras",
	"Hong Kong",
	"Hungary",
	"Iceland",
	"India",
	"Indonesia",
	"Iran (Islamic Republic of)",
	"Iraq",
	"Ireland",
	"Israel",
	"Italy",
	"Jamaica",
	"Japan",
	"Jordan",
	"Kazakhstan",
	"Kenya",
	"Kiribati",
	"Korea, Democratic People's Republic of",
	"Korea, Republic of",
	"Kuwait",
	"Kyrgyzstan",
	"Lao People's Democratic Republic",
	"Latvia",
	"Lebanon",
	"Lesotho",
	"Liberia",
	"Libyan Arab Jamahiriya",
	"Liechtenstein",
	"Lithuania",
	"Luxembourg",
	"Macau",
	"Macedonia, The Former Yugoslav Republic of",
	"Madagascar",
	"Malawi",
	"Malaysia",
	"Maldives",
	"Mali",
	"Malta",
	"Marshall Islands",
	"Martinique",
	"Mauritania",
	"Mauritius",
	"Mayotte",
	"Mexico",
	"Micronesia, Federated States of",
	"Moldova, Republic of",
	"Monaco",
	"Mongolia",
	"Montserrat",
	"Morocco",
	"Mozambique",
	"Myanmar",
	"Namibia",
	"Nauru",
	"Nepal",
	"Netherlands",
	"Netherlands Antilles",
	"New Caledonia",
	"New Zealand",
	"Nicaragua",
	"Niger",
	"Nigeria",
	"Niue",
	"Norfolk Island",
	"Northern Mariana Islands",
	"Norway",
	"Oman",
	"Pakistan",
	"Palau",
	"Panama",
	"Papua New Guinea",
	"Paraguay",
	"Peru",
	"Philippines",
	"Pitcairn",
	"Poland",
	"Portugal",
	"Puerto Rico",
	"Qatar",
	"Reunion",
	"Romania",
	"Russian Federation",
	"Rwanda",
	"Saint Kitts and Nevis",
	"Saint LUCIA",
	"Saint Vincent and the Grenadines",
	"Samoa",
	"San Marino",
	"Sao Tome and Principe",
	"Saudi Arabia",
	"Senegal",
	"Seychelles",
	"Sierra Leone",
	"Singapore",
	"Slovakia (Slovak Republic)",
	"Slovenia",
	"Solomon Islands",
	"Somalia",
	"South Africa",
	"South Georgia and the South Sandwich Islands",
	"Spain",
	"Sri Lanka",
	"St. Helena",
	"St. Pierre and Miquelon",
	"Sudan",
	"Suriname",
	"Svalbard and Jan Mayen Islands",
	"Swaziland",
	"Sweden",
	"Switzerland",
	"Syrian Arab Republic",
	"Taiwan, Province of China",
	"Tajikistan",
	"Tanzania, United Republic of",
	"Thailand",
	"Togo",
	"Tokelau",
	"Tonga",
	"Trinidad and Tobago",
	"Tunisia",
	"Turkey",
	"Turkmenistan",
	"Turks and Caicos Islands",
	"Tuvalu",
	"Uganda",
	"Ukraine",
	"United Arab Emirates",
	"United Kingdom",
	"United States",
	"United States Minor Outlying Islands",
	"Uruguay",
	"Uzbekistan",
	"Vanuatu",
	"Venezuela",
	"Viet Nam",
	"Virgin Islands (British)",
	"Virgin Islands (U.S.)",
	"Wallis and Futuna Islands",
	"Western Sahara",
	"Yemen",
	"Yugoslavia",
	"Zambia",
	"Zimbabwe"
];

criticalError = function ()
{
	console.trace.apply(this, arguments);
}

UTCNow = function()
{
    var now = new Date();
    var now_utc = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),  now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
    return now_utc;
};

Shared =
{
	/**
	 * Calculate final price for given item with a specific plan and discount
	 * @param item
	 * @param plan
	 * @param discount
	 * @return {Number}
	 */
	calculateItemPriceWithDiscount: function (item, plan, discount)
	{
		var price = parseFloat(plan.price);
		return Shared.calculatePriceWithDiscount(price, discount);
	},

	/**
	 * Calculate final price for given item with a specific plan,discount and taxes
	 * @param item
	 * @param plan
	 * @param discount
	 * @return {Number}
	 */
	calculateItemPriceWithDiscountAndTax: function (item, plan, discount, publisher)
	{
		var price = parseFloat(plan.price);
		var discountedPrice = Shared.calculatePriceWithDiscount(price, discount);

		if (plan.taxable)
		{
			return Shared.calculatePriceWithTax(price,publisher,plan.taxable);
		}
		else
		{
			return discountedPrice;
		}
	},

	calculatePriceWithDiscount: function (price, discount)
	{
		price = parseFloat(price);
		if (discount && Shared.isDiscountValid(discount))
		{
			if (discount.use_fixed)
				price = parseFloat(Math.max(0, price - discount.fixed).toFixed(2));
			else
				price = parseFloat(Math.max(0, price - price * (discount.amount / 100)).toFixed(2));
		}
		return Math.max(0, price);
	},

	calculatePriceWithDiscountAndTax: function(price, discount, publisher, taxable)
	{
		return Shared.calculatePriceWithTax(Shared.calculatePriceWithDiscount(price,discount), publisher, taxable);
	},



	calculatePriceWithTax: function(price, publisher, taxable)
	{
		if(taxable)
		{
			if (publisher.tax_type == TaxType.None)
			{
				return parseFloat(price.toFixed(2));
			}
			else if (publisher.tax_type == TaxType.Include)
			{
				return parseFloat(price.toFixed(2));
			}
			else if (publisher.tax_type == TaxType.Exclude && publisher.tax_amount)
			{
				return parseFloat((price * (100+publisher.tax_amount)/100).toFixed(2));
			}
			else
			{
				return parseFloat(price.toFixed(2));
			}
		}
		else
		{
			return parseFloat(price.toFixed(2));
		}

	},

	//Calculate the taxes that was from initial price
	calculateTaxFromPrice: function(price, publisher, taxable)
	{
		if(taxable)
		{
			if (publisher.tax_type == TaxType.None)
			{
				return parseFloat((0).toFixed(2));
			}
			else if (publisher.tax_type == TaxType.Include)
			{
				return parseFloat((price * (publisher.tax_amount/(publisher.tax_amount + 100))).toFixed(2));
			}
			else if (publisher.tax_type == TaxType.Exclude && publisher.tax_amount)
			{
				return parseFloat((price * (publisher.tax_amount/100)).toFixed(2));
			}
			else
			{
				return parseFloat((0).toFixed(2));
			}
		}
		else
		{
			return parseFloat((0).toFixed(2));
		}

	},


	// Choose discount to apply in a specific order:
	// (bundle rule discount OR bundle) discount OR plan discount OR item discount
	// if item belongs to a bundle, discard item/plan discounts
	getItemDiscountId: function (item, plan, bundle, rule)
	{
		if (!bundle) return plan.discount_id || item.discount_id;
		return (rule && rule.discount_id) || (bundle && bundle.discount_id);
	},

	getItemDiscount: function (item, plan, bundle, rule)
	{
		if (!bundle)
			return (Shared.isDiscountValid(plan.discount) && plan.discount) ||
				(Shared.isDiscountValid(item.discount) && item.discount);

		return (rule && Shared.isDiscountValid(rule.discount) && rule.discount)
			|| (bundle && Shared.isDiscountValid(bundle.discount) && bundle.discount);
	},

	getProductDiscount: function(product, option)
	{
		return (option && Shared.isDiscountValid(option.discount) && option.discount)
			|| (product && Shared.isDiscountValid(product.discount) && product.discount);
	},

	/**
	 * Check if discount is valid or not
	 * @param discount
	 * @return {Boolean}
	 */
	 isDiscountValid: function (discount)
	{
		if (!discount) return false;

		var startDate = (discount.start_date instanceof Date) ? discount.start_date : new Date(discount.start_date);
		var endDate = (discount.end_date instanceof Date) ? discount.end_date : new Date(discount.end_date);
		var now = new Date();

		if (!discount || !discount.active || startDate > now || endDate < now) return false;
		return true;
	},

	getDiscountString: function (discount, from, to)
	{
		if (!discount) return "";

		var suffix = Shared.getDiscountStateString(discount);
		if (suffix) suffix = " (" + suffix + ")";

		return Shared.getDiscountValueString(discount) + suffix;
	},

	getDiscountValueString: function (discount)
	{
		if (!discount) return "";

		if (discount.use_fixed) return discount.fixed.toFixed(2);
		return discount.amount + "%";
	},

	getDiscountValue: function (discount, from, to)
	{
		if (!discount) return null;
		var value = discount.use_fixed ? discount.fixed : discount.amount;
		if (!value) return null;

		if (from && to) value = Shared.getPriceInCurrency(value, from, to);
		return value;
	},

	getDiscountStateString: function (discount)
	{
		if (!discount) return "";

		var suffix = "";
		if (!discount.active) suffix = "inactive";
		if (!discount.start_date || !discount.end_date) return "invalid";

		if (discount.start_date > new Date()) suffix = "not yet started";
		else if (discount.end_date < new Date()) suffix = "expired";
		return suffix;
	},

	/**
	 * Get item price according to specified currency
	 * @param price
	 * @param from
	 * @param to
	 */
	getPriceInCurrency: function (price, from, to)
	{
		//console.log("Converting price %s from %s to %s", price, from.apiCode, to.apiCode);	// TODO
		var sgd = (1 / from.exchange_rate) * price;
		var final = (sgd * to.exchange_rate).toFixed(2);
		//console.log("Price in SGD: %s, price in %s: %s", sgd, to.apiCode, final);	// TODO
		return parseFloat(final);
	},

	/**
	 * Check validity of an email address
	 * @param email
	 * @return {Boolean}
	 */
	isEmailValid: function (email)
	{
		if (!email) return false;
		var filter = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
		return filter.test(email);
	},

	generateString: function (length)
	{
		var charset = "QWERTYUIOPLKJHGFDSAZXCVBNMqwertyuioplkjhgfdsazxcvbnm1234567890";
		var s = new Array(length);
		for (var i = 0; i < length; i++)
			s[i] = charset.charAt((Math.random() * charset.length) | 0);
		return s.join("");
	},

	isUserValid: function (user, callback)
	{
		if (!user)
		{
			callback && callback("Invalid user object");
			return false;
		}

		if (!Shared.isEmailValid(user.email))
		{
			callback && callback("E-Mail address is not valid");
			return false;
		}

		callback && callback();
		return true;
	},

	/**
	 * Get the number of login methods usable by a user account.
	 * @param user
	 * @returns number
	 */
	getLoginMethodCount: function (user)
	{
		var count = 0;
		if ("user" in user && user.user && "password" in user && user.password)
		{
			count++;
		}

		if ("fb_id" in user && user.fb_id && "fb_active" in user && user.fb_active == "1")
		{
			count++;
		}

		return count;
	},

	/**
	 *	Concat all strings, if string is null ,replace it with empty string
	 **/
	concatAll : function()
	{
		var s = '';
		for(var x in arguments) {
			s += arguments[x] == null ? '' : (' ' + arguments[x]);
		}
		return s;
	}
};

/** For a given javascript object and a value,
 * get the key for the value
 * @param o - (javascript object)
 * @param value - value to search for the key
 * @returns {key}
 */
getKey = function (o, value)
{
	for (var prop in o)
	{
		if (o.hasOwnProperty(prop))
		{
			if (o[ prop ] == value)
				return prop;
		}
	}
}


/**
 * For an javascript array object in this format :
 * [
 *	 {id : 234,
 *	value : "value"},
 *	 {id : 345,
 *	value : "ready"}
 * ]
 *
 * Return an object in this format
 * {
 *   234 : {id : 234, value: "value"},
 *   345 : {id : 345, value: "ready"}
 * }
 * @param array
 * @param id
 * @returns {
 *   234 : {id : 234, value: "value"},
 *   345 : {id : 345, value: "ready"}
 * }
 */
createMap = function (array, id)
{
	id = id || "id";
	var map = {};
	for (var i = 0; i < array.length; i++)
		map[array[i][id]] = array[i];
	return map;
}

zeroPad = function (num, places)
{
	var zero = places - num.toString().length + 1;
	return Array(+(zero > 0 && zero)).join("0") + num;
}

ensureModel = function (data, model)
{
	for (var field in model)
	{
		var value = data[field];

		// check if exists
		if (!value && !model[field][1]) return "Invalid non-optional parameter '" + field + "'";
		var type = (model[field][0] || "").toLowerCase();
		if (!type) continue;		// don't check for type

		if (type == "array" && Array.isArray(value)) return "Parameter '" + field + "' is expected to be of type Array";
		if (typeof value != type) return "Parameter '" + field + "' is expected to be of type " + model[field][0];
	}
}




/*
 * ----------------------------------------------------------------------------
 * Package:     JS Date Format Patch
 * Version:     0.9.12
 * Date:        2012-07-06
 * Description: In lack of decent formatting ability of Javascript Date object,
 *              I have created this "patch" for the Date object which will add
 *              "Date.format(dateObject, format)" static function, and the
 *              "dateObject.toFormattedString(format)" member function.
 *              Along with the formatting abilities, I have also added the
 *              following functions for parsing dates:
 *              "Date.parseFormatted(value, format)" - static function
 *              "dateObject.fromFormattedString(value, format)" - member
 *              function
 * Author:      Miljenko Barbir
 * Author URL:  http://miljenkobarbir.com/
 * Repository:  http://github.com/barbir/js-date-format
 * ----------------------------------------------------------------------------
 * Copyright (c) 2010 Miljenko Barbir
 * Dual licensed under the MIT and GPL licenses.
 * ----------------------------------------------------------------------------
 */


// extend the Javascript Date class with the "format" static function which will format
// the provided date object using the provided format string
Date._format = function (date, format)
{
	// get the helper functions object
	var formatLogic = Date.formatLogic;

	// check if the AM/PM option is used
	var isAmPm = (format.indexOf("a") !== -1) || (format.indexOf("A") !== -1);

	// prepare all the parts of the date that can be used in the format
	var parts = [];
	parts['d'] = date.getDate();
	parts['dd'] = formatLogic.pad(parts['d'], 2);
	parts['ddd'] = formatLogic.i18n.shortDayNames[date.getDay()];
	parts['dddd'] = formatLogic.i18n.dayNames[date.getDay()];
	parts['M'] = date.getMonth() + 1;
	parts['MM'] = formatLogic.pad(parts['M'], 2);
	parts['MMM'] = formatLogic.i18n.shortMonthNames[parts['M'] - 1];
	parts['MMMM'] = formatLogic.i18n.monthNames[parts['M'] - 1];
	parts['yyyy'] = date.getFullYear();
	parts['yyy'] = formatLogic.pad(parts['yyyy'], 2) + 'y';
	parts['yy'] = formatLogic.pad(parts['yyyy'], 2);
	parts['y'] = 'y';
	parts['H'] = date.getHours();
	parts['hh'] = formatLogic.pad(isAmPm ? formatLogic.convertTo12Hour(parts['H']) : parts['H'], 2);
	parts['h'] = isAmPm ? formatLogic.convertTo12Hour(parts['H']) : parts['H'];
	parts['HH'] = formatLogic.pad(parts['H'], 2);
	parts['m'] = date.getMinutes();
	parts['mm'] = formatLogic.pad(parts['m'], 2);
	parts['s'] = date.getSeconds();
	parts['ss'] = formatLogic.pad(parts['s'], 2);
	parts['z'] = date.getMilliseconds();
	parts['zz'] = parts['z'] + 'z';
	parts['zzz'] = formatLogic.pad(parts['z'], 3);
	parts['ap'] = parts['H'] < 12 ? 'am' : 'pm';
	parts['a'] = parts['H'] < 12 ? 'am' : 'pm';
	parts['AP'] = parts['H'] < 12 ? 'AM' : 'PM';
	parts['A'] = parts['H'] < 12 ? 'AM' : 'PM';

	// parse the input format, char by char
	var i = 0;
	var output = "";
	var token = "";
	while (i < format.length)
	{
		token = format.charAt(i);

		while ((i + 1 < format.length) && parts[token + format.charAt(i + 1)] !== undefined)
		{
			token += format.charAt(++i);
		}

		if (parts[token] !== undefined)
		{
			output += parts[token];
		}
		else
		{
			output += token;
		}

		i++;
	}

	// return the parsed result
	return output;
};

// this is the format logic helper object that contains the helper functions
// and the internationalization settings that can be overridden
Date.formatLogic =
{
	// left-pad the provided number with zeros
	pad: function (value, digits)
	{
		var max = 1;
		var zeros = "";

		if (digits < 1)
		{
			return "";
		}

		for (var i = 0; i < digits; i++)
		{
			max *= 10;
			zeros += "0";
		}

		var output = value;

		output = zeros + value;
		output = output.substring(output.length - digits);

		return output;
	},

	// convert the 24 hour style value to a 12 hour style value
	convertTo12Hour: function (value)
	{
		return value % 12 === 0 ? 12 : value % 12;
	},

	// internationalization settings
	i18n: {
		dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
		shortDayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
		monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
		shortMonthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
	}
};

// add a member "format" function which will return the string representation
// of the current object formatted using the provided format string
Date.prototype.format = function (format)
{
	return Date._format(this, format);
};

// extend the Javascript Date class with the "parseFormatted" static function which
// will parse the provided string, using the provided format into a valid date object
Date.parseFormatted = function (value, format)
{
	var output = new Date(2000, 0, 1);
	var parts = [];
	parts['d'] = '([0-9][0-9]?)';
	parts['dd'] = '([0-9][0-9])';
//	parts['ddd']	= NOT SUPPORTED;
//	parts['dddd']	= NOT SUPPORTED;
	parts['M'] = '([0-9][0-9]?)';
	parts['MM'] = '([0-9][0-9])';
//	parts['MMM']	= NOT SUPPORTED;
//	parts['MMMM']	= NOT SUPPORTED;
	parts['yyyy'] = '([0-9][0-9][0-9][0-9])';
	parts['yyy'] = '([0-9][0-9])[y]';
	parts['yy'] = '([0-9][0-9])';
	parts['H'] = '([0-9][0-9]?)';
	parts['hh'] = '([0-9][0-9])';
	parts['h'] = '([0-9][0-9]?)';
	parts['HH'] = '([0-9][0-9])';
	parts['m'] = '([0-9][0-9]?)';
	parts['mm'] = '([0-9][0-9])';
	parts['s'] = '([0-9][0-9]?)';
	parts['ss'] = '([0-9][0-9])';
	parts['z'] = '([0-9][0-9]?[0-9]?)';
	parts['zz'] = '([0-9][0-9]?[0-9]?)[z]';
	parts['zzz'] = '([0-9][0-9][0-9])';
	parts['ap'] = '([ap][m])';
	parts['a'] = '([ap][m])';
	parts['AP'] = '([AP][M])';
	parts['A'] = '([AP][M])';

	var _ = Date.parseLogic;

	// parse the input format, char by char
	var i = 0;
	var regex = "";
	var outputs = new Array("");
	var token = "";

	// parse the format to get the extraction regex
	while (i < format.length)
	{
		token = format.charAt(i);
		while ((i + 1 < format.length) && parts[token + format.charAt(i + 1)] !== undefined)
		{
			token += format.charAt(++i);
		}

		if (parts[token] !== undefined)
		{
			regex += parts[token];
			outputs[outputs.length] = token;
		}
		else
		{
			regex += token;
		}

		i++;
	}

	// extract matches
	var r = new RegExp(regex);
	var matches = value.match(r);

	if (matches === undefined || matches.length !== outputs.length)
	{
		return undefined;
	}

	// parse each match and update the output date object
	for (i = 0; i < outputs.length; i++)
	{
		if (outputs[i] !== '')
		{
			switch (outputs[i])
			{
				case 'yyyy':
				case 'yyy':
					output.setYear(_.parseInt(matches[i]));
					break;

				case 'yy':
					output.setYear(2000 + _.parseInt(matches[i]));
					break;

				case 'MM':
				case 'M':
					output.setMonth(_.parseInt(matches[i]) - 1);
					break;

				case 'dd':
				case 'd':
					output.setDate(_.parseInt(matches[i]));
					break;

				case 'hh':
				case 'h':
				case 'HH':
				case 'H':
					output.setHours(_.parseInt(matches[i]));
					break;

				case 'mm':
				case 'm':
					output.setMinutes(_.parseInt(matches[i]));
					break;

				case 'ss':
				case 's':
					output.setSeconds(_.parseInt(matches[i]));
					break;

				case 'zzz':
				case 'zz':
				case 'z':
					output.setMilliseconds(_.parseInt(matches[i]));
					break;

				case 'AP':
				case 'A':
				case 'ap':
				case 'a':
					if ((matches[i] === 'PM' || matches[i] === 'pm') && (output.getHours() < 12))
					{
						output.setHours(output.getHours() + 12);
					}

					if ((matches[i] === 'AM' || matches[i] === 'am') && (output.getHours() === 12))
					{
						output.setHours(0);
					}
					break;
			}
		}
	}

	return output;
};

// this is the parse logic helper object that contains the helper functions
Date.parseLogic =
{
	unpad: function (value)
	{
		var output = value;

		while (output.length > 1)
		{
			if (output[0] === '0')
			{
				output = output.substring(1, output.length);
			}
			else
			{
				break;
			}
		}

		return output;
	},
	parseInt: function (value)
	{
		return parseInt(this.unpad(value), 10);
	}
};

// add a member "from" function which will return the date object, created
// from the provided string and the format
Date.prototype.fromFormattedString = function (value, format)
{
	this.setTime(Date.parseFormatted(value, format).getTime());
	return this;
};


//Convert a date to timezone listed in offset(minutes). Returns null if offset is not there
convertDateToLocalDate = function(date,offset)
{
	date = new Date(date);
	if(offset === null) return null;
	date.setUTCMinutes(date.getUTCMinutes() + offset);
	return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
}

convertOffSetToUTCString = function(offset)
{
	if(offset === null || isNaN(offset))
	{
		return "";
	}
	else
	{
		if(offset < 0)
		{
			return "UTC" + offset/60;
		}
		else
		{
			return "UTC+" + offset/60;
		}
	}
}




concatList = function()
{
    var result = [];

    for(var a = 0; a < arguments.length; ++a)
        result = result.concat(arguments[a]);

    return result;
}

/** For an amount of array, interleave the array starting from the array that has the biggest size
 * and return the array using this example
 * Array 1 = [1,2,3]
 * Array 2 = [a,b,c,d,e]
 * Array 3 = [!,@,#,$]
 * Return = [a,!,1,b,@,2,c,#,3,d,$,e]
 * @arguments array1, array2, array3, ...
 */
interLeaveLists = function ()
{
	var result = [];
	var lengths = [];
	for (var a = 0; a < arguments.length; a++)
	{
		lengths.push(arguments[a].length);
	}

	if (lengths.length)
	{
		lengths = lengths.sort(function(a,b){return b-a}); 	//Sort in descending numerical order

		var max = lengths[0];
		for (var i = 0; i < max; i++)
		{
			for (var a = 0; a < arguments.length; a++)
			{
				var v = arguments[a][i];
				if (v) result.push(v);
			}
		}
	}
	return result;
};

/**
 * Compute the offset request to be sent in MultiPagination
 * @param requiredOffset
 * @param totals			Array of numbers (total of each list)
 * @return object			{offset: offset to request in MultiPagination,
 * 							pointer: pointer to insert in mainlist}
 */
computeRequestOffset = function (requiredOffset, totals)
{
	if (!totals.length) return {offset: 0, pointer: 0};

	var total = totals.reduce(function (a, b) { return a + b; }, 0);
	var min = totals.reduce(function (a, b){ return a < b ? a : b; }, total);
	var leastOffset = Math.floor(requiredOffset / totals.length);

	if (min > leastOffset) min = leastOffset;

	var toFill = requiredOffset - (min * totals.length);

	totals = totals.filter(function (a) { return a > min; });

	while (totals.length && toFill >= totals.length)
	{
		min++;
		toFill -= totals.length;
		totals = totals.filter(function (a) { return a > min; });
	}
	return {offset: min, pointer: requiredOffset - toFill};

};

cloneObject = function (obj)
{
	if (obj === null || typeof obj !== 'object')
		return obj;

	var temp = obj.constructor(); // give temp the original obj's constructor
	for (var key in obj)
		temp[key] = cloneObject(obj[key]);

	return temp;
}

validateUrl = function (value){
	return /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i.test(value);
}

processVideoIframe = function (video)
{
	if (validateUrl(video))
	{
		var extension = video.match(/\.(mp4|ogg)$/);
		if (extension && extension.length)
		{
			var result = {type:"url", url: video, videoType: extension[1]};
			return JSON.stringify(result);
		}
		else
		{
			return null;
		}
	}
	else
	{
		// Remove line breaks and extra spaces
		video = video.replace(/\s+/g," ").replace(/^ | $/g, "");

		var matches = video.match(/<iframe\s?([^>]*)\s?>((?:(?!<\/iframe>).)*)<\/iframe>/);

		var invalidIframe = true;

		if (matches && matches.length==3)
		{
			var src = null;

			var iframe = matches[0];
			var contents = matches[2];
			var attributes = matches[1]
				.replace(/'/,"\"")
				.split(" ")
				.filter(function (a)
				{
					var pair = a.split("=");

					switch (pair[0])
					{
						case "width":
						case "height":
							return false;
						case "src":
							src = (pair[1] != "\"\"") && pair[1];
						default:
							return true;
					}
				});

			if (attributes && attributes.length && src)
			{
				var res = {};

				res.type = "iframe";
				attributes.forEach(function (a)
				{
					var pair = a.split("=");
					res[pair[0]] = pair[1];
				});

				video = JSON.stringify(res);

				invalidIframe = false;
			}
		}
		return !invalidIframe && video;
	}


};

makeVideoEmbed = function (video)
{
	if (!video) return null;

	video = JSON.parse(video);
	var type = video.type;

	delete video.type;

	switch (type)
	{
		case "iframe":
			var attrs=[];
			for (var i in video)
			{
				attrs.push(i + "=" + video[i]);
			}
			return "<iframe :attrs></iframe>".replace(/:attrs/, attrs.join(" "));

		case "url":
			return ("<video controls>\
						<source src=':url' type='video/:videoType'>\
						Your browser does not support the video tag.\
					</video>")
				.replace(/:url/, video.url)
				.replace(/:videoType/, video.videoType);

		default:
			return null;
	}
};

Errors =
{
	// General
	Unspecified: 						1,
	InvalidData: 						2,

	// System
	InternalError: 						100,
	DatabaseError: 						101,
	AccessDenied: 						102,
	MissingParameter: 					103,
	InsufficientPermission:				104,
	ModuleNotEnabled:					105,
	InvalidDomain:						106,

	// API
	InvalidUser:						1000,
	InvalidUsernameOrPassword:			1001,
	AccountSuspended:					1002,
	AccountNotActivated:				1003,
	UsernameTaken:						1004,
	EmailTaken:							1005,
	InvalidPassword:					1006,
	FacebookAccessTokenValidationError: 1007,
	UserFacebookDeactivated: 			1008,
	InsufficientLoginMethods: 			1009,
	FacebookAccountLinkExists: 			1010,
	AccountAlreadyExists: 				1011,
	InvalidEmail: 						1012,
	BitlyUrlShortenError:				1013,
	InvalidUsername:					1014,
	InvalidIframe:						1015,
	FacebookEmailInvalid:				1016,

	// Store
	UserAlreadyHasIssue:				2001,
	UserAlreadyHasSubscription:			2002,
	InvalidOwnership:					2003,
	AppStoreTransactionInvalid:			2004
}

NotificationCode =
{
	UpdatedIssue:						1004,
	NewIssue:							1005
}

DummyAdsArray = [
    {   //100x600
        title: "100x600 SliderSkaper 1",
        adsunit_id: 1,
        width: 100,
        height: 600,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {
        title: "100x600 SliderSkaper 2",
        adsunit_id: 2,
        width: 100,
        height: 600,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {
        title: "100x600 SliderSkaper 12",
        adsunit_id: 12,
        width: 100,
        height: 600,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {
        title: "100x600 SliderSkaper 14",
        adsunit_id: 14,
        width: 100,
        height: 600,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {   //728x90
        title: "728x90 SliderSkaper 4",
        adsunit_id: 4,
        width: 728,
        height: 90,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {
        title: "728x90 SliderSkaper 9",
        adsunit_id: 9,
        width: 728,
        height: 90,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {
        title: "728x90 SliderSkaper 23",
        adsunit_id: 23,
        width: 728,
        height: 90,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {
        title: "728x90 SliderSkaper 31",
        adsunit_id: 31,
        width: 728,
        height: 90,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {
        title: "728x90 SliderSkaper 87",
        adsunit_id: 87,
        width: 728,
        height: 90,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {   //200x200
        title: "200x200 SliderSkaper 20",
        adsunit_id: 20,
        width: 200,
        height: 200,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {
        title: "200x200 SliderSkaper 21",
        adsunit_id: 21,
        width: 200,
        height: 200,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {
        title: "200x200 SliderSkaper 22",
        adsunit_id: 22,
        width: 200,
        height: 200,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {
        title: "200x200 SliderSkaper 23",
        adsunit_id: 23,
        width: 200,
        height: 200,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {
        title: "200x200 SliderSkaper 24",
        adsunit_id: 24,
        width: 200,
        height: 200,
        thumbnail: "http://lorempixel.com/90/90/"
    }, {
        title: "200x200 SliderSkaper 25",
        adsunit_id: 25,
        width: 200,
        height: 200,
        thumbnail: "http://lorempixel.com/90/90/"
    }, {
        title: "200x200 SliderSkaper 28",
        adsunit_id: 28,
        width: 200,
        height: 200,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {
        title: "200x200 SliderSkaper 29",
        adsunit_id: 29,
        width: 200,
        height: 200,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {   //960x1200
        title: "960x1200 SliderSkaper 50",
        adsunit_id: 50,
        width: 960,
        height: 1200,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {
        title: "960x1200 SliderSkaper 51",
        adsunit_id: 51,
        width: 960,
        height: 1200,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {
        title: "960x1200 SliderSkaper 51",
        adsunit_id: 51,
        width: 960,
        height: 1200,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {
        title: "960x1200 SliderSkaper 51",
        adsunit_id: 55,
        width: 960,
        height: 1200,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {
        title: "960x1200 SliderSkaper 51",
        adsunit_id: 59,
        width: 960,
        height: 1200,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {
        title: "960x1200 SliderSkaper 51",
        adsunit_id: 60,
        width: 960,
        height: 1200,
        thumbnail: "http://lorempixel.com/90/90/"
    },
    {
        title: "960x1200 SliderSkaper 51",
        adsunit_id: 61,
        width: 960,
        height: 1200,
        thumbnail: "http://lorempixel.com/90/90/"
    }
];
