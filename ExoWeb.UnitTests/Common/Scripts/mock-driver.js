﻿
if (ExoWeb.Mock) {
	//ExoWeb.Mock.typeProviderDelay = 10;
	//ExoWeb.Mock.objectProviderDelay = 200;
	//ExoWeb.Mock.listProviderDelay = 500;

	ExoWeb.Mock.types({
		Person: {
			properties: {
				Name: { type: "String", rules: [{ required: {} }, { stringLength: { max: 40}}] },
				BirthDate: { type: "Date", format: "ShortDate" },
				PhoneNumber: { type: "String", format: "Phone", rules: [{ required: {}}] }
			}
		},
		Driver: {
			baseType: "Person",
			properties: {
				Owner: { type: "CarOwner" },
				Cars: { type: "Car>Product", isList: true, rules: [{ required: {} }, { allowedValues: { source: "this.Dealer.AvailableCars"}}] },
				Dealer: { type: "Dealer>Person", rules: [{ allowedValues: { source: "Dealer.All"}}] },
				MilesDriven: { type: "Number", rules: [{ range: { min: 0}}] },
				DateCreated: { type: "Date" },
				SalesPerson: { type: "Employee>Person", rules: [{ allowedValues: { source: "this.AllowedSalesPersons"}}] },
				AllowedSalesPersons: { type: "Employee>Person", isList: "true" },
				Notes: { type: "String", rules: [{ stringLength: { max: 100}}] }
			}
		},
		Employee: {
			baseType: "Person",
			properties: {
				All: { type: "Employee>Person", isList: true, isStatic: true },
				Title: { type: "String" },
				HireDate: { type: "Date" }
			}
		},
		Product: {
			properties: {
				Name: { type: "String" }
			}
		},
		Car: {
			baseType: "Product",
			properties: {
				Driver: { type: "Driver>Person" }
			}
		},
		NewCar: {
			baseType: "Car>Product",
			properties: {
				PlantNumber: { type: "String" }
			}
		},
		UsedCar: {
			baseType: "Car>Product",
			properties: {
				Mileage: { type: "Number" },
				BoughtFrom: { type: "Person" }
			}
		},
		Dealer: {
			baseType: "Person",
			properties: {
				All: { type: "Dealer>Person", isList: true, isStatic: true },
				AvailableCars: { type: "Car", isList: true }
			}
		},
		CarOwner: {
			properties: {
				Name: { type: "String" },
				Location: { type: "OwnerLocation", rules: [{ allowedValues: { source: "this.AvailableLocations"}}] },
				AvailableLocations: { type: "OwnerLocation", isList: true },
				Partner: { type: "CarOwner" },
				Drivers: { type: "Driver>Person", isList: true }
			}
		},
		OwnerLocation: {
			properties: {
				Name: { type: "String" },
				Address: { type: "LocationAddress" }
			}
		},
		LocationAddress: {
			properties: {
				State: { type: "AddressState" }
			}
		},
		AddressState: {
			properties: {
				Abbreviation: { type: "String" },
				Name: { type: "String" }
			}
		}
	});

	ExoWeb.Mock.objects({
		Employee: {
			static: {
				All: [{ id: "100" }, { id: "101" }, { id: "102"}]
			},
			100: {
				Name: "Joe Salesperson",
				BirthDate: new Date("03/01/1987"),
				PhoneNumber: "123-123-1234",
				Title: "Salesperson",
				HireDate: new Date("1/1/2005")
			},
			101: {
				Name: "New Salesperson",
				BirthDate: new Date("12/22/1980"),
				PhoneNumber: "123-123-1234",
				Title: "Salesperson",
				HireDate: new Date("1/1/2009")
			},
			102: {
				Name: "Jane Manager",
				BirthDate: new Date("01/30/1956"),
				PhoneNumber: "123-123-1234",
				Title: "Manager"
			}
		},
		Driver: {
			1: {
				Name: "Bryan Matthews",
				Cars: [{ id: "1" }, { id: "2"}],
				Owner: { id: "1" },
				BirthDate: new Date("02/07/1985"),
				PhoneNumber: "803-608-7508",
				Dealer: { id: "1" },
				MilesDriven: 100000,
				DateCreated: new Date("1/1/2007"),
				SalesPerson: {id: "100"},
				Notes: null
			}
		},
		Car: {
			1: {
				Name: "Sentra",
				Driver: { id: "1" }
			},
			2: {
				Name: "Bike",
				Driver: { id: "1" }
			},
			3: {
				Name: "Tank",
				Driver: null
			}
		},
		NewCar: {
			100: {
				Name: "Focus",
				Driver: null,
				PlantNumber: "AZ9"
			}
		},
		UsedCar: {
			200: {
				Name: "Taurus",
				Driver: null,
				BoughtFrom: { id: "1" },
				Mileage: 68100
			}
		},
		Dealer: {
			static: {
				All: [{ id: "1" }, { id: "2"}]
			},
			1: {
				Name: "Dick Smith Nissan",
				AvailableCars: [{ id: "1" }, { id: "2" }, { id: "3"}]
			},
			2: {
				Name: "Johnny's Suzuki",
				AvailableCars: []
			}
		},
		CarOwner: {
			1: {
				Name: "Bob",
				Location: { id: "1" },
				AvailableLocations: [{ id: "1" }, { id: "2"}],
				Partner: { id: "2" },
				Drivers: [ { id: "1" } ]
			},
			2: {
				Name: "Joe",
				Location: { id: "2" },
				AvailableLocations: [{ id: "1" }, { id: "2"}],
				Partner: { id: "1" },
				Drivers: []
			}
		},
		OwnerLocation: {
			1: {
				Name: "Home",
				Address: { id: "1" }
			},
			2: {
				Name: "Work",
				Address: { id: "2" }
			}
		},
		LocationAddress: {
			1: {
				State: { id: "1" }
			},
			2: {
				State: { id: "1" }
			}
		},
		AddressState: {
			1: {
				Abbreviation: "NY",
				Name: "New York"
			}
		}
	});

	ExoWeb.Mock.roundtrip({
		// no behavior by default
	});

	ExoWeb.Mock.save({
		// no behavior by default
	});
}
else {
	function getOwner(name, age/*, cars */) {
		var owner = {
			name: name,
			age: age,
			cars: []
		};

		Array.forEach(Array.prototype.slice.call(arguments), function(item, index) {
			if (index > 1) {
				owner.cars.push(item);
			}
		});

		return owner;
	}

	window.getOwner = getOwner;

	function getCar(make, owner) {
		var car = {
			make: make,
			owner: null
		};

		if (owner) {
			car.owner = owner;
			if (!Array.contains(owner.cars, car)) {
				owner.cars.push(car);
			}
		}

		return car;
	}

	window.getCar = getCar;

	function getDriver(name, age, car, owner) {
		var driver = {
			name:  name,
			age:  age,
			car: null
		};

		if (car) {
			driver.car = car;
			if (owner) {
				driver.car.owner = owner;
				if (!Array.contains(owner.cars, car)) {
					owner.cars.push(car);
				}
			}
		}

		return driver;
	}

	window.getDriver = getDriver;
}